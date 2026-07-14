const { body, validationResult } = require('express-validator');

// CHECK 6: Middleware to handle validation errors uniformly
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return a 400 Bad Request with the first error message
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const validateProfileUpdate = [
  body('first_name').optional().isString().trim().isLength({ max: 50 }).withMessage('First name too long'),
  body('last_name').optional().isString().trim().isLength({ max: 50 }).withMessage('Last name too long'),
  body('bio').optional().isString().isLength({ max: 1000 }).withMessage('Bio cannot exceed 1000 characters'),
  body('dob').optional().isISO8601().withMessage('Invalid date format for dob'),
  handleValidationErrors
];

const validatePhone = [
  body('phone_no').isString().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format (E.164 required)'),
  body('about').optional().isString().isLength({ max: 50 }).withMessage('About cannot exceed 50 characters'),
  handleValidationErrors
];

const validateSkill = [
  body('skill_name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Skill name must be 1-100 characters'),
  handleValidationErrors
];

const validateCertification = [
  body('certification_name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 chars'),
  body('issued_by').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Issuer must be 1-100 chars'),
  body('certificate_url').optional({ checkFalsy: true }).isURL({ require_protocol: true, protocols: ['https'] }).withMessage('Invalid certificate URL (must be HTTPS)'),
  handleValidationErrors
];

const validateEducation = [
  body('institution').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Institution must be 1-100 chars'),
  body('score').isFloat({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
  handleValidationErrors
];

module.exports = {
  validateProfileUpdate,
  validatePhone,
  validateSkill,
  validateCertification,
  validateEducation
};
