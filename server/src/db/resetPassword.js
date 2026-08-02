import { get, run } from './index.js';
import { hashPassword, generatePassword } from '../utils/password.js';

/**
 * Console password reset.
 *
 * There is no email on a LAN deployment, so "forgot password" cannot be
 * self-service. Whoever has access to the server machine runs this; that is
 * the intended trust boundary.
 *
 *   npm run reset-password -- <username> [new-password]
 */
const [, , username, providedPassword] = process.argv;

if (!username) {
  console.log('\nUsage: npm run reset-password -- <username> [new-password]\n');
  const users = get('SELECT GROUP_CONCAT(username, ", ") AS names FROM users WHERE is_active = 1');
  console.log(`Active users: ${users?.names ?? '(none)'}\n`);
  process.exit(1);
}

const user = get('SELECT id, username, role FROM users WHERE username = ?', [username]);
if (!user) {
  console.error(`\nNo user named "${username}".\n`);
  process.exit(1);
}

const password = providedPassword || generatePassword(14);
run('UPDATE users SET password_hash = ?, must_change_password = 1, is_active = 1 WHERE id = ?', [
  hashPassword(password),
  user.id,
]);

console.log(
  '\n' +
    '  ┌──────────────────────────────────────────────────────┐\n' +
    '  │  Password reset                                      │\n' +
    `  │  username: ${user.username.padEnd(42)}│\n` +
    `  │  password: ${password.padEnd(42)}│\n` +
    '  │                                                      │\n' +
    '  │  The user must change this at next sign-in.          │\n' +
    '  └──────────────────────────────────────────────────────┘\n',
);
