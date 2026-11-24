const mongoose = require('mongoose');
const Inquiry = require('../models/Inquiry');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const submitInquiry = async (req, res, next) => {
  try {
    const {
      customerName,
      email,
      phone,
      inquiryType = 'exchange',
      branch = 'New Road Central Counter, Kathmandu',
      appointmentDate = '',
      appointmentTimeSlot = '',
      metal = 'gold',
      carat = '22K',
      weightInGrams = 1,
      estimatedValue = 0,
      message = ''
    } = req.body;

    if (!customerName || !phone) {
      return errorResponse(res, { statusCode: 400, message: 'Name and phone number are required' });
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
      return successResponse(res, { statusCode: 201, message: 'Your request has been registered successfully! Our team will contact you shortly.', data: inquiry });
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
      return successResponse(res, { statusCode: 201, message: 'Your request has been registered successfully! Our team will contact you shortly.', data: inquiry });
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
    if (mongoose.connection.readyState === 1) {
      const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return successResponse(res, { message: 'Inquiry updated', data: inquiry });
    } else {
      const inq = memoryStore.inquiries.find(i => i._id === req.params.id);
      if (inq) Object.assign(inq, req.body);
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
  submitInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
};
