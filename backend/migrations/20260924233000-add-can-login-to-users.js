'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    if (!tableInfo.can_login) {
      await queryInterface.addColumn('users', 'can_login', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    await queryInterface.changeColumn('users', 'email', {
      type: Sequelize.STRING(100),
      allowNull: true,
      unique: true
    });
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.can_login) {
      await queryInterface.removeColumn('users', 'can_login');
    }
  }
};
