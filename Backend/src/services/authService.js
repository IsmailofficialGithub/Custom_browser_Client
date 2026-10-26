'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const config = require('../config');

async function loginUser(email, password) {
  if (!email || !password) {
    return {
      success: false,
      token: '',
      message: 'Email and password are required.',
      userId: '',
      email: ''
    };
  }

  console.log(`[authService] Login attempt for: ${email}`);
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() }
  });

  if (!user) {
    console.log(`[authService] User not found: ${email}`);
    return {
      success: false,
      token: '',
      message: 'Invalid email or password.',
      userId: '',
      email: ''
    };
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    console.log(`[authService] Password mismatch for: ${email}`);
    return {
      success: false,
      token: '',
      message: 'Invalid email or password.',
      userId: '',
      email: ''
    };
  }
  console.log(`[authService] Login successful for: ${email}`);

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    success: true,
    token,
    message: 'Login successful.',
    userId: user.id,
    email: user.email
  };
}

module.exports = {
  loginUser
};
