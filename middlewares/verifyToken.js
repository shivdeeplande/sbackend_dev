const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

const verifyToken = (req, res, next) => {
    
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({success:false,
        code:401, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY); // Verify the token
    console.log('decoded',decoded);
    
    req.user = decoded; // Attach decoded token to request
    next(); // Proceed to the next middleware/route handler
  } catch (err) {
    return res.status(403).json({ success:false,
        code:403, message: 'Invalid or expired token.' });
  }
};
module.exports = {
    verifyToken
};