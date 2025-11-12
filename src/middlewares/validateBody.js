const { ZodError } = require('zod');



module.exports.validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body); 
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: err.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      });
    }
    return res.status(400).json({ 
      success: false, 
      message: 'Dữ liệu không hợp lệ' 
    });
  }
};
