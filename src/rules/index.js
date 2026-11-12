'use strict';

const { assess } = require('./engine');
const { PATTERNS, PERSONAL_EMAIL_DOMAINS } = require('./patterns');

module.exports = { assess, PATTERNS, PERSONAL_EMAIL_DOMAINS };
