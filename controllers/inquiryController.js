const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { MAX_DAILY_APPOINTMENTS, APPOINTMENT_TIME_SLOTS, INQUIRY_STATUSES } = require('../config/constants');

const getAvailableSlots = async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const branch = typeof req.query.branch === 'string' ? req.query.branch.slice(0, 150) : '';
    if (!DATE_RE.test(date)) {
      return errorResponse(res, { statusCode: 400, message: 'Date parameter (YYYY-MM-DD) is required.' });
    }

    const filter = {
      appointmentDate: date,
      inquiryType: 'valuation_appointment',
      status: { $ne: 'cancelled' }
    };
    if (branch) {
      filter.branch = branch;
    }

    let bookedInquiries = [];
    if (mongoose.connection.readyState === 1) {
      bookedInquiries = await Inquiry.find(filter).select('appointmentTimeSlot branch customerName');
    } else {
      bookedInquiries = memoryStore.inquiries.filter(i =>
        i.appointmentDate === date &&
        i.inquiryType === 'valuation_appointment' &&
        i.status !== 'cancelled' &&
        (!branch || i.branch === branch)
      );
    }

    const bookedSlots = bookedInquiries.map(i => i.appointmentTimeSlot).filter(Boolean);
    const bookedSet = new Set(bookedSlots);

    const totalDailyLimit = MAX_DAILY_APPOINTMENTS || 28;
    const bookedCount = bookedSlots.length;
    const isFullyBooked = bookedCount >= totalDailyLimit;

    // Filter out already booked slots so they are not shown to users
    const availableSlots = isFullyBooked
      ? []
      : (APPOINTMENT_TIME_SLOTS || []).filter(slot => !bookedSet.has(slot));

    return successResponse(res, {
      message: 'Available appointment slots retrieved successfully',
      data: {
        date,
        branch: branch || 'All Branches',
        totalDailyLimit,
        bookedCount,
        remainingSlots: Math.max(0, totalDailyLimit - bookedCount),
        isFullyBooked,
        allSlots: APPOINTMENT_TIME_SLOTS || [],
        availableSlots,
        bookedSlots
      }
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Input validation for the public forms ----------
const INQUIRY_TYPE_VALUES = ['exchange', 'sell_gold', 'sell_silver', 'valuation_appointment', 'general', 'complaint'];
const METAL_VALUES = ['gold', 'silver', 'both'];
const CARAT_VALUES = ['24K', '22K', '18K', '14K', 'Silver', 'Other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const validateInquiry = (body = {}) => {
  const v = {
    customerName: str(body.customerName, 100),
    email: str(body.email, 254).toLowerCase(),
    phone: str(body.phone, 20),
    inquiryType: body.inquiryType === undefined ? 'exchange' : body.inquiryType,
    branch: str(body.branch, 150),
    appointmentDate: str(body.appointmentDate, 10),
    appointmentTimeSlot: str(body.appointmentTimeSlot, 40),
    metal: body.metal === undefined ? 'gold' : body.metal,
    carat: body.carat === undefined ? '22K' : body.carat,
    weightInGrams: body.weightInGrams === undefined ? 1 : Number(body.weightInGrams),
    estimatedValue: body.estimatedValue === undefined ? 0 : Number(body.estimatedValue),
    message: str(body.message, 2000),
  };
  if (!v.customerName || !v.phone) return { error: 'Name and phone number are required' };
  if (!PHONE_RE.test(v.phone)) return { error: 'Please enter a valid phone number' };
  if (v.email && !EMAIL_RE.test(v.email)) return { error: 'Please enter a valid email address' };
  if (!INQUIRY_TYPE_VALUES.includes(v.inquiryType)) return { error: 'Invalid enquiry type' };
  if (!METAL_VALUES.includes(v.metal)) return { error: 'Invalid metal' };
  if (!CARAT_VALUES.includes(v.carat)) return { error: 'Invalid carat' };
  if (!Number.isFinite(v.weightInGrams) || v.weightInGrams < 0.1 || v.weightInGrams > 100000) return { error: 'Weight must be between 0.1 g and 100 kg' };
  if (!Number.isFinite(v.estimatedValue) || v.estimatedValue < 0) v.estimatedValue = 0;
  if (v.appointmentDate && !DATE_RE.test(v.appointmentDate)) return { error: 'Appointment date must be YYYY-MM-DD' };
  if (v.appointmentTimeSlot && !(APPOINTMENT_TIME_SLOTS || []).includes(v.appointmentTimeSlot)) return { error: 'Please choose one of the listed time slots' };
  return { value: v };
};

const submitInquiry = async (req, res, next) => {
  try {
    const checked = validateInquiry(req.body);
    if (checked.error) {
      return errorResponse(res, { statusCode: 400, message: checked.error });
    }
    const {
      customerName,
      email,
      phone,
      inquiryType,
      appointmentDate,
      appointmentTimeSlot,
      metal,
      carat,
      weightInGrams,
      estimatedValue,
      message
    } = checked.value;
    const branch = checked.value.branch || 'Head Office';

    // Appointment-specific business rules
    if (inquiryType === 'valuation_appointment' || appointmentDate) {
      if (!appointmentDate || !appointmentTimeSlot) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Both appointment date and 30-minute time slot are required for valuation bookings.'
        });
      }

      // Check date is not in past
      const todayStr = new Date().toISOString().split('T')[0];
      if (appointmentDate < todayStr) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Appointments cannot be booked for past dates. Please choose today or a future date.'
        });
      }

      const cleanPhone = phone.trim();
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const userCondition = [{ phone: cleanPhone }];
      if (cleanEmail) userCondition.push({ email: cleanEmail });

      const totalDailyLimit = MAX_DAILY_APPOINTMENTS || 28;

      if (mongoose.connection.readyState === 1) {
        // 1. One user can take only one appointment per day
        const existingUserBooking = await Inquiry.findOne({
          appointmentDate,
          inquiryType: 'valuation_appointment',
          status: { $ne: 'cancelled' },
          $or: userCondition
        });
        if (existingUserBooking) {
          return errorResponse(res, {
            statusCode: 400,
            message: `You already have an appointment booked for ${appointmentDate} (${existingUserBooking.appointmentTimeSlot}). Each customer can book a maximum of 1 appointment per day.`
          });
        }

        // 2. Maximum 28 appointments per day per branch
        const dailyCount = await Inquiry.countDocuments({
          appointmentDate,
          branch,
          inquiryType: 'valuation_appointment',
          status: { $ne: 'cancelled' }
        });
        if (dailyCount >= totalDailyLimit) {
          return errorResponse(res, {
            statusCode: 400,
            message: `The maximum daily limit of ${totalDailyLimit} appointments has been reached for ${appointmentDate} at this branch. Please choose another date.`
          });
        }

        // 3. Time slot availability (only assign if slot is available)
        const slotConflict = await Inquiry.findOne({
          appointmentDate,
          branch,
          appointmentTimeSlot,
          inquiryType: 'valuation_appointment',
          status: { $ne: 'cancelled' }
        });
        if (slotConflict) {
          return errorResponse(res, {
            statusCode: 400,
            message: `The 30-minute time slot '${appointmentTimeSlot}' on ${appointmentDate} is already booked. Please choose an available time slot.`
          });
        }
      } else {
        // Memory store fallback
        const existingUserBooking = memoryStore.inquiries.find(i =>
          i.appointmentDate === appointmentDate &&
          i.inquiryType === 'valuation_appointment' &&
          i.status !== 'cancelled' &&
          (i.phone === cleanPhone || (cleanEmail && i.email === cleanEmail))
        );
        if (existingUserBooking) {
          return errorResponse(res, {
            statusCode: 400,
            message: `You already have an appointment booked for ${appointmentDate} (${existingUserBooking.appointmentTimeSlot}). Each customer can book a maximum of 1 appointment per day.`
          });
        }

        const branchDayInquiries = memoryStore.inquiries.filter(i =>
          i.appointmentDate === appointmentDate &&
          i.branch === branch &&
          i.inquiryType === 'valuation_appointment' &&
          i.status !== 'cancelled'
        );
        if (branchDayInquiries.length >= totalDailyLimit) {
          return errorResponse(res, {
            statusCode: 400,
            message: `The maximum daily limit of ${totalDailyLimit} appointments has been reached for ${appointmentDate}. Please choose another date.`
          });
        }

        const slotConflict = branchDayInquiries.find(i => i.appointmentTimeSlot === appointmentTimeSlot);
        if (slotConflict) {
          return errorResponse(res, {
            statusCode: 400,
            message: `The 30-minute time slot '${appointmentTimeSlot}' on ${appointmentDate} is already booked. Please choose an available time slot.`
          });
        }
      }
    }

    if (mongoose.connection.readyState === 1) {
      const inquiry = await Inquiry.create({
        customerName,
        email: email || `${phone}@kuberacustomer.com`,
        phone,
        inquiryType,
        branch,
        appointmentDate,
        appointmentTimeSlot,
        metal,
        goldDetails: { carat, weightInGrams: Number(weightInGrams || 1), estimatedValue: Number(estimatedValue || 0) },
        message
      });
      return successResponse(res, { statusCode: 201, message: 'Your appointment has been registered successfully! Our counter team is expecting your visit.', data: inquiry });
    } else {
      const inquiry = {
        _id: String(Date.now()),
        customerName,
        email: email || `${phone}@kuberacustomer.com`,
        phone,
        inquiryType,
        branch,
        appointmentDate,
        appointmentTimeSlot,
        metal,
        goldDetails: { carat, weightInGrams: Number(weightInGrams || 1), estimatedValue: Number(estimatedValue || 0) },
        message,
        status: 'pending',
        createdAt: new Date()
      };
      memoryStore.inquiries.unshift(inquiry);
      return successResponse(res, { statusCode: 201, message: 'Your appointment has been registered successfully! Our counter team is expecting your visit.', data: inquiry });
    }
  } catch (error) {
    next(error);
  }
};

const getAllInquiries = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const { status, type } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (type) filter.inquiryType = type;
      const inquiries = await Inquiry.find(filter).sort({ createdAt: -1 });
      return successResponse(res, { message: 'Inquiries fetched successfully', data: inquiries });
    } else {
      let inquiries = [...memoryStore.inquiries];
      if (req.query.status) inquiries = inquiries.filter(i => i.status === req.query.status);
      if (req.query.type) inquiries = inquiries.filter(i => i.inquiryType === req.query.type);
      return successResponse(res, { message: 'Inquiries fetched successfully', data: inquiries });
    }
  } catch (error) {
    next(error);
  }
};

const updateInquiryStatus = async (req, res, next) => {
  try {
    // Staff may change only the workflow fields, never the customer's submitted details
    const changes = {};
    if (req.body.status !== undefined) {
      if (!INQUIRY_STATUSES.includes(req.body.status)) {
        return errorResponse(res, { statusCode: 400, message: `Status must be one of: ${INQUIRY_STATUSES.join(', ')}` });
      }
      changes.status = req.body.status;
    }
    if (req.body.adminNotes !== undefined) changes.adminNotes = str(req.body.adminNotes, 2000);

    if (mongoose.connection.readyState === 1) {
      if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
      const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
      if (!inquiry) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
      return successResponse(res, { message: 'Inquiry updated', data: inquiry });
    } else {
      const inq = memoryStore.inquiries.find(i => i._id === req.params.id);
      if (!inq) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
      Object.assign(inq, changes);
      return successResponse(res, { message: 'Inquiry updated', data: inq });
    }
  } catch (error) {
    next(error);
  }
};

const deleteInquiry = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Inquiry.findByIdAndDelete(req.params.id);
    } else {
      memoryStore.inquiries = memoryStore.inquiries.filter(i => i._id !== req.params.id);
    }
    return successResponse(res, { message: 'Inquiry deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableSlots,
  submitInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
};
