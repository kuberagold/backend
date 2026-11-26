const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  MAX_DAILY_APPOINTMENTS,
  APPOINTMENT_TIME_SLOTS,
  INQUIRY_STATUSES,
  NEPAL_TIMEZONE
} = require('../config/constants');

const APPOINTMENT = 'valuation_appointment';
const SLOTS = APPOINTMENT_TIME_SLOTS || [];
const DAILY_LIMIT = MAX_DAILY_APPOINTMENTS || 14;
// Statuses that no longer hold a time slot
const FREE_STATUSES = ['cancelled'];

const INQUIRY_TYPE_VALUES = ['exchange', 'sell_gold', 'sell_silver', APPOINTMENT, 'general', 'complaint'];
const METAL_VALUES = ['gold', 'silver', 'both'];
const CARAT_VALUES = ['24K', '22K', '18K', '14K', 'Silver', 'Other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const dbReady = () => mongoose.connection.readyState === 1;
// sanitizeFilter (server.js) turns any {$op: ...} in a filter into a plain value, which also breaks
// operators the server builds itself. Mark those as trusted; values from users never go in here raw.
const trusted = (obj) => mongoose.trusted(obj);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Calendar date in Nepal (YYYY-MM-DD), optionally shifted by whole days
const nepalDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: NEPAL_TIMEZONE || 'Asia/Kathmandu' })
    .format(new Date(Date.now() + offsetDays * 864e5));

const slotIndex = (slot) => {
  const i = SLOTS.indexOf(slot);
  return i === -1 ? SLOTS.length : i;
};
// Appointments in schedule order (date, then time slot); other records newest first
const scheduleOrder = (a, b) =>
  (a.appointmentDate || '').localeCompare(b.appointmentDate || '') ||
  slotIndex(a.appointmentTimeSlot) - slotIndex(b.appointmentTimeSlot);

// ---------- Booking rules shared by the public form, staff bookings and rescheduling ----------
// Returns an error message, or null when the slot can be taken.
const checkBooking = async ({ date, slot, branch, phone, email, excludeId, allowPast = false }) => {
  if (!DATE_RE.test(date || '')) return 'Appointment date must be YYYY-MM-DD.';
  if (!SLOTS.includes(slot)) return 'Please choose one of the listed time slots.';
  if (!allowPast && date < nepalDate()) {
    return 'Appointments cannot be booked for past dates. Please choose today or a future date.';
  }

  const sameDay = (i) =>
    i.appointmentDate === date &&
    i.inquiryType === APPOINTMENT &&
    !FREE_STATUSES.includes(i.status) &&
    String(i._id) !== String(excludeId || '');

  let dayBookings;
  if (dbReady()) {
    const filter = { appointmentDate: date, inquiryType: APPOINTMENT, status: trusted({ $nin: FREE_STATUSES }) };
    if (excludeId && mongoose.isValidObjectId(excludeId)) filter._id = trusted({ $ne: excludeId });
    dayBookings = await Inquiry.find(filter).select('appointmentTimeSlot branch phone email').lean();
  } else {
    dayBookings = memoryStore.inquiries.filter(sameDay);
  }

  // 1. One appointment per customer per day (matched on phone or email)
  const cleanPhone = (phone || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const mine = dayBookings.find((i) => (cleanPhone && i.phone === cleanPhone) || (cleanEmail && i.email === cleanEmail));
  if (mine) {
    return `This customer already has an appointment on ${date} (${mine.appointmentTimeSlot}). Each customer can book a maximum of 1 appointment per day.`;
  }

  // 2. Daily limit per branch, 3. one booking per slot per branch
  const atBranch = dayBookings.filter((i) => i.branch === branch);
  if (atBranch.length >= DAILY_LIMIT) {
    return `The maximum daily limit of ${DAILY_LIMIT} appointments has been reached for ${date} at this branch. Please choose another date.`;
  }
  if (atBranch.some((i) => i.appointmentTimeSlot === slot)) {
    return `The 30-minute time slot '${slot}' on ${date} is already booked. Please choose an available time slot.`;
  }
  return null;
};

// ---------- Public: free slots for a date (and branch) ----------
const getAvailableSlots = async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const branch = typeof req.query.branch === 'string' ? req.query.branch.slice(0, 150) : '';
    if (!DATE_RE.test(date)) {
      return errorResponse(res, { statusCode: 400, message: 'Date parameter (YYYY-MM-DD) is required.' });
    }

    let booked = [];
    if (dbReady()) {
      const filter = { appointmentDate: date, inquiryType: APPOINTMENT, status: trusted({ $nin: FREE_STATUSES }) };
      if (branch) filter.branch = branch;
      booked = await Inquiry.find(filter).select('appointmentTimeSlot').lean();
    } else {
      booked = memoryStore.inquiries.filter((i) =>
        i.appointmentDate === date && i.inquiryType === APPOINTMENT && !FREE_STATUSES.includes(i.status) && (!branch || i.branch === branch));
    }

    const bookedSlots = booked.map((i) => i.appointmentTimeSlot).filter(Boolean);
    const bookedSet = new Set(bookedSlots);
    const isFullyBooked = bookedSlots.length >= DAILY_LIMIT;

    return successResponse(res, {
      message: 'Available appointment slots retrieved successfully',
      data: {
        date,
        branch: branch || 'All Branches',
        totalDailyLimit: DAILY_LIMIT,
        bookedCount: bookedSlots.length,
        remainingSlots: Math.max(0, DAILY_LIMIT - bookedSlots.length),
        isFullyBooked,
        allSlots: SLOTS,
        availableSlots: isFullyBooked ? [] : SLOTS.filter((s) => !bookedSet.has(s)),
        // Only slot labels, never who booked them (this endpoint is public)
        bookedSlots
      }
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Input validation for the public form and staff bookings ----------
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
    weightInGrams: body.weightInGrams === undefined || body.weightInGrams === '' ? 1 : Number(body.weightInGrams),
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
  if (v.appointmentTimeSlot && !SLOTS.includes(v.appointmentTimeSlot)) return { error: 'Please choose one of the listed time slots' };
  return { value: v };
};

const buildRecord = (v, extra = {}) => ({
  customerName: v.customerName,
  email: v.email || `${v.phone.replace(/\D/g, '')}@kuberacustomer.com`,
  phone: v.phone,
  inquiryType: v.inquiryType,
  branch: v.branch || 'Head Office',
  appointmentDate: v.appointmentDate,
  appointmentTimeSlot: v.appointmentTimeSlot,
  metal: v.metal,
  goldDetails: { carat: v.carat, weightInGrams: Number(v.weightInGrams || 1), estimatedValue: Number(v.estimatedValue || 0) },
  message: v.message,
  ...extra
});

const saveRecord = async (record) => {
  if (dbReady()) return Inquiry.create(record);
  const doc = { _id: String(Date.now()), status: 'pending', createdAt: new Date(), updatedAt: new Date(), ...record };
  memoryStore.inquiries.unshift(doc);
  return doc;
};

// ---------- Public: enquiry / appointment form ----------
const submitInquiry = async (req, res, next) => {
  try {
    const checked = validateInquiry(req.body);
    if (checked.error) return errorResponse(res, { statusCode: 400, message: checked.error });
    const v = checked.value;
    v.branch = v.branch || 'Head Office';

    if (v.inquiryType === APPOINTMENT || v.appointmentDate) {
      if (!v.appointmentDate || !v.appointmentTimeSlot) {
        return errorResponse(res, { statusCode: 400, message: 'Both appointment date and 30-minute time slot are required for valuation bookings.' });
      }
      const problem = await checkBooking({ date: v.appointmentDate, slot: v.appointmentTimeSlot, branch: v.branch, phone: v.phone, email: v.email });
      if (problem) return errorResponse(res, { statusCode: 400, message: problem });
    }

    const inquiry = await saveRecord(buildRecord(v, { source: 'website' }));
    return successResponse(res, {
      statusCode: 201,
      message: 'Your appointment has been registered successfully! Our counter team is expecting your visit.',
      data: inquiry
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Admin: book an appointment for a phone or walk-in customer ----------
const createAppointmentByStaff = async (req, res, next) => {
  try {
    const checked = validateInquiry({ ...req.body, inquiryType: APPOINTMENT });
    if (checked.error) return errorResponse(res, { statusCode: 400, message: checked.error });
    const v = checked.value;
    if (!v.branch) return errorResponse(res, { statusCode: 400, message: 'Please choose a branch.' });
    if (!v.appointmentDate || !v.appointmentTimeSlot) {
      return errorResponse(res, { statusCode: 400, message: 'Please choose a date and a time slot.' });
    }
    const status = req.body.status === undefined ? 'confirmed' : req.body.status;
    if (!['pending', 'confirmed'].includes(status)) {
      return errorResponse(res, { statusCode: 400, message: 'A new booking must be pending or confirmed.' });
    }

    const problem = await checkBooking({ date: v.appointmentDate, slot: v.appointmentTimeSlot, branch: v.branch, phone: v.phone, email: v.email });
    if (problem) return errorResponse(res, { statusCode: 400, message: problem });

    const inquiry = await saveRecord(buildRecord(v, {
      status,
      source: 'admin',
      adminNotes: str(req.body.adminNotes, 2000),
      updatedBy: req.user?._id
    }));
    return successResponse(res, { statusCode: 201, message: 'Appointment booked', data: inquiry });
  } catch (error) {
    next(error);
  }
};

// ---------- Admin: list with filters ----------
// Query: kind=appointments|enquiries, status, type, date, from, to, branch, q (name / phone / email)
const getAllInquiries = async (req, res, next) => {
  try {
    const q = (k, max = 150) => (typeof req.query[k] === 'string' ? req.query[k].trim().slice(0, max) : '');
    const kind = q('kind');
    const status = q('status');
    const type = q('type');
    const date = q('date', 10);
    const from = q('from', 10);
    const to = q('to', 10);
    const branch = q('branch');
    const search = q('q', 80);

    if (status && !INQUIRY_STATUSES.includes(status)) return errorResponse(res, { statusCode: 400, message: 'Unknown status' });
    for (const d of [date, from, to]) {
      if (d && !DATE_RE.test(d)) return errorResponse(res, { statusCode: 400, message: 'Dates must be YYYY-MM-DD' });
    }

    let list;
    if (dbReady()) {
      const filter = {};
      if (kind === 'appointments') filter.inquiryType = APPOINTMENT;
      else if (kind === 'enquiries') filter.inquiryType = trusted({ $ne: APPOINTMENT });
      if (type && INQUIRY_TYPE_VALUES.includes(type)) filter.inquiryType = type;
      if (status) filter.status = status;
      if (branch) filter.branch = branch;
      if (date) filter.appointmentDate = date;
      else if (from || to) {
        const range = {};
        if (from) range.$gte = from;
        if (to) range.$lte = to;
        filter.appointmentDate = trusted(range); // values already checked against DATE_RE
      }
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ customerName: rx }, { phone: rx }, { email: rx }];
      }
      list = await Inquiry.find(filter).sort({ createdAt: -1 }).limit(1000).populate('updatedBy', 'name').lean();
    } else {
      const s = search.toLowerCase();
      list = memoryStore.inquiries.filter((i) =>
        (kind !== 'appointments' || i.inquiryType === APPOINTMENT) &&
        (kind !== 'enquiries' || i.inquiryType !== APPOINTMENT) &&
        (!type || i.inquiryType === type) &&
        (!status || i.status === status) &&
        (!branch || i.branch === branch) &&
        (!date || i.appointmentDate === date) &&
        (!from || (i.appointmentDate || '') >= from) &&
        (!to || (i.appointmentDate || '') <= to) &&
        (!s || [i.customerName, i.phone, i.email].some((f) => (f || '').toLowerCase().includes(s))));
    }

    if (kind === 'appointments') list = [...list].sort(scheduleOrder);
    return successResponse(res, { message: 'Inquiries fetched successfully', data: list });
  } catch (error) {
    next(error);
  }
};

// ---------- Admin: dashboard numbers ----------
const getInquiryStats = async (req, res, next) => {
  try {
    const today = nepalDate();
    const weekEnd = nepalDate(6);
    const weekAgo = new Date(Date.now() - 7 * 864e5);

    const all = dbReady()
      ? await Inquiry.find({
        $or: [
          { inquiryType: APPOINTMENT, appointmentDate: trusted({ $gte: nepalDate(-30) }) },
          { inquiryType: trusted({ $ne: APPOINTMENT }) },
          { status: 'pending' }
        ]
      }).select('-message -adminNotes').lean()
      : memoryStore.inquiries;

    const appts = all.filter((i) => i.inquiryType === APPOINTMENT);
    const enquiries = all.filter((i) => i.inquiryType !== APPOINTMENT);
    const active = (i) => !['cancelled', 'no_show'].includes(i.status);

    const todayList = appts.filter((i) => i.appointmentDate === today && active(i)).sort(scheduleOrder);
    const upcoming = appts
      .filter((i) => i.appointmentDate >= today && ['pending', 'confirmed'].includes(i.status))
      .sort(scheduleOrder);

    const byBranchToday = {};
    todayList.forEach((i) => { byBranchToday[i.branch] = (byBranchToday[i.branch] || 0) + 1; });

    return successResponse(res, {
      message: 'Dashboard statistics',
      data: {
        today,
        dailyLimitPerBranch: DAILY_LIMIT,
        appointments: {
          today: todayList.length,
          todayCompleted: todayList.filter((i) => i.status === 'completed').length,
          awaitingConfirmation: appts.filter((i) => i.status === 'pending' && i.appointmentDate >= today).length,
          next7Days: appts.filter((i) => i.appointmentDate >= today && i.appointmentDate <= weekEnd && active(i)).length,
          byBranchToday,
          upcoming: upcoming.slice(0, 8).map((i) => ({
            _id: i._id,
            customerName: i.customerName,
            phone: i.phone,
            branch: i.branch,
            appointmentDate: i.appointmentDate,
            appointmentTimeSlot: i.appointmentTimeSlot,
            status: i.status,
            metal: i.metal,
            goldDetails: i.goldDetails
          }))
        },
        enquiries: {
          pending: enquiries.filter((i) => i.status === 'pending').length,
          newThisWeek: enquiries.filter((i) => new Date(i.createdAt) >= weekAgo).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Admin: status, notes, and rescheduling ----------
const updateInquiryStatus = async (req, res, next) => {
  try {
    const id = req.params.id;
    let current;
    if (dbReady()) {
      if (!mongoose.isValidObjectId(id)) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
      current = await Inquiry.findById(id).lean();
    } else {
      current = memoryStore.inquiries.find((i) => i._id === id);
    }
    if (!current) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });

    // Staff may change only workflow fields and the schedule, never the customer's submitted details
    const changes = {};
    if (req.body.status !== undefined) {
      if (!INQUIRY_STATUSES.includes(req.body.status)) {
        return errorResponse(res, { statusCode: 400, message: `Status must be one of: ${INQUIRY_STATUSES.join(', ')}` });
      }
      changes.status = req.body.status;
    }
    if (req.body.adminNotes !== undefined) changes.adminNotes = str(req.body.adminNotes, 2000);

    const wantsReschedule = ['appointmentDate', 'appointmentTimeSlot', 'branch'].some((k) => req.body[k] !== undefined);
    if (wantsReschedule) {
      if (current.inquiryType !== APPOINTMENT) {
        return errorResponse(res, { statusCode: 400, message: 'Only appointments can be rescheduled.' });
      }
      const next = {
        date: req.body.appointmentDate !== undefined ? str(req.body.appointmentDate, 10) : current.appointmentDate,
        slot: req.body.appointmentTimeSlot !== undefined ? str(req.body.appointmentTimeSlot, 40) : current.appointmentTimeSlot,
        branch: req.body.branch !== undefined ? str(req.body.branch, 150) : current.branch
      };
      if (!next.branch) return errorResponse(res, { statusCode: 400, message: 'Please choose a branch.' });
      const moved = next.date !== current.appointmentDate || next.slot !== current.appointmentTimeSlot || next.branch !== current.branch;
      if (moved) {
        const problem = await checkBooking({ ...next, phone: current.phone, email: current.email, excludeId: id });
        if (problem) return errorResponse(res, { statusCode: 400, message: problem });
        changes.appointmentDate = next.date;
        changes.appointmentTimeSlot = next.slot;
        changes.branch = next.branch;
      }
    }

    // Re-opening a cancelled booking needs its slot to still be free
    if (changes.status && FREE_STATUSES.includes(current.status) && !FREE_STATUSES.includes(changes.status) &&
        current.inquiryType === APPOINTMENT && !changes.appointmentDate) {
      const problem = await checkBooking({
        date: current.appointmentDate, slot: current.appointmentTimeSlot, branch: current.branch,
        phone: current.phone, email: current.email, excludeId: id, allowPast: true
      });
      if (problem) return errorResponse(res, { statusCode: 400, message: `Cannot restore this booking: ${problem}` });
    }

    if (dbReady()) {
      changes.updatedBy = req.user?._id;
      const inquiry = await Inquiry.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).populate('updatedBy', 'name');
      return successResponse(res, { message: 'Updated', data: inquiry });
    }
    Object.assign(current, changes, { updatedAt: new Date() });
    return successResponse(res, { message: 'Updated', data: current });
  } catch (error) {
    next(error);
  }
};

const deleteInquiry = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (dbReady()) {
      if (!mongoose.isValidObjectId(id)) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
      const gone = await Inquiry.findByIdAndDelete(id);
      if (!gone) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
    } else {
      const before = memoryStore.inquiries.length;
      memoryStore.inquiries = memoryStore.inquiries.filter((i) => i._id !== id);
      if (memoryStore.inquiries.length === before) return errorResponse(res, { statusCode: 404, message: 'Inquiry not found' });
    }
    return successResponse(res, { message: 'Inquiry deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableSlots,
  submitInquiry,
  createAppointmentByStaff,
  getAllInquiries,
  getInquiryStats,
  updateInquiryStatus,
  deleteInquiry
};
