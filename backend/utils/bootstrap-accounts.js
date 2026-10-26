const bcrypt = require('bcryptjs');

// Retire only the exact legacy credentials; preserve accounts whose password was changed.
async function retireDefaultAccounts(User) {
  for (const [email, password] of [['developer@looppe.com', 'L00pp3'], ['admin@test.com', 'admin123']]) {
    const user = await User.findOne({ where: { email } });
    if (user?.password_hash && await bcrypt.compare(password, user.password_hash)) {
      await user.update({ can_login: false, is_active: false, password_hash: null });
    }
  }
}

module.exports = { retireDefaultAccounts };
