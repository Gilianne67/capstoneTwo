/**
 * Minimum length for a password the user chooses.
 * Signup, password change, and password reset must all use this value.
 * The matching frontend constant is frontend/src/config/passwordPolicy.js.
 * Password hashing stays bcrypt in the User model and is not affected.
 * The User schema applies this minimum to plaintext before hashing.
 */
const MIN_PASSWORD_LENGTH = 15;

module.exports = {
  MIN_PASSWORD_LENGTH,
};
