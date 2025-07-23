/**
 * Invitation Configuration Service
 * Manages the invitation mode for teacher creation (EMAIL vs DEFAULT_PASSWORD)
 */

export const INVITATION_MODES = {
  EMAIL: 'EMAIL',
  DEFAULT_PASSWORD: 'DEFAULT_PASSWORD'
};

export const DEFAULT_PASSWORD = '123456';

export const invitationConfig = {
  getCurrentMode,
  isEmailMode,
  isDefaultPasswordMode,
  getDefaultPassword,
  validateMode
};

/**
 * Get current invitation mode from environment
 * Defaults to EMAIL for backward compatibility
 */
function getCurrentMode() {
  const mode = process.env.INVITATION_MODE || INVITATION_MODES.EMAIL;
  if (!validateMode(mode)) {
    console.warn(`Invalid INVITATION_MODE: ${mode}. Falling back to EMAIL mode.`);
    return INVITATION_MODES.EMAIL;
  }
  return mode;
}

/**
 * Check if current mode is EMAIL (legacy invitation system)
 */
function isEmailMode() {
  return getCurrentMode() === INVITATION_MODES.EMAIL;
}

/**
 * Check if current mode is DEFAULT_PASSWORD (simplified system)
 */
function isDefaultPasswordMode() {
  return getCurrentMode() === INVITATION_MODES.DEFAULT_PASSWORD;
}

/**
 * Get the default password for new teachers
 */
function getDefaultPassword() {
  return DEFAULT_PASSWORD;
}

/**
 * Validate if a mode is supported
 */
function validateMode(mode) {
  return Object.values(INVITATION_MODES).includes(mode);
}

// Log current configuration on module load
console.log(`🔧 Invitation System Mode: ${getCurrentMode()}`);