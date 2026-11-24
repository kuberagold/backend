const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  GUEST: 'guest'
};

const PERMISSIONS = {
  [ROLES.SUPERADMIN]: [
    'manage_users',
    'manage_admins',
    'update_gold_rates',
    'manage_banners',
    'manage_blogs',
    'manage_inquiries',
    'manage_settings',
    'view_audit_logs'
  ],
  [ROLES.ADMIN]: [
    'update_gold_rates',
    'manage_banners',
    'manage_blogs',
    'manage_inquiries',
    'view_settings'
  ],
  [ROLES.GUEST]: [
    'view_gold_rates',
    'view_banners',
    'view_blogs',
    'submit_inquiry',
    'use_calculator'
  ]
};

module.exports = {
  ROLES,
  PERMISSIONS
};
