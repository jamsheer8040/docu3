const { Op } = require('sequelize');
const finance = require('../utils/managementFinance');
const {
  Shareholder,
  CapitalTransaction,
  DividendDeclaration,
  DividendDistribution,
  DividendPayment,
  SystemConfig,
  WalletAccount,
  sequelize
} = require('../models');

// Helpers
const getCompanyCapital = async (tenant_id, transaction) => {
  const config = await SystemConfig.findOne({
    where: { key: 'proposed_company_capital', tenant_id }, transaction
  });
  return config ? finance.units(config.value, 'Company capital', true) / 100 : 0;
};

// -----------------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------------
exports.getDashboardStats = async (req, res) => {
  try {
    const data = await sequelize.transaction(async transaction => {
    const tenant_id = req.user.tenant_id;
    const companyCapital = await getCompanyCapital(tenant_id, transaction);

    const shareholders = await Shareholder.findAll({ where: { tenant_id, status: 'Active' }, transaction });
    const totalShareholders = shareholders.length;

    // Sum capital transactions
    const transactions = await CapitalTransaction.findAll({ where: { tenant_id }, transaction });
    let totalContributed = 0;
    
    transactions.forEach(t => {
      if (t.type === 'Adjustment') finance.fail('Historical adjustments need reconciliation before totals can be used.', 409);
      if (t.type === 'Contribution' || t.type === 'Advance') {
        totalContributed += finance.units(t.amount, 'Historical capital amount');
      } else if (t.type === 'Refund') {
        totalContributed -= finance.units(t.amount, 'Historical capital amount');
      }
    });

    totalContributed /= 100;
    const outstandingCapital = Math.max(0, Math.round(companyCapital * 100) - Math.round(totalContributed * 100)) / 100;
    const excessCapital = Math.max(0, Math.round(totalContributed * 100) - Math.round(companyCapital * 100)) / 100;

    // Dividends
    const declarations = await DividendDeclaration.findAll({ where: { tenant_id, status: { [Op.notIn]: ['Draft', 'Cancelled'] } }, transaction });
    const totalDividendsDeclared = declarations.reduce((sum, d) => sum + finance.units(d.dividend_amount), 0) / 100;
    
    const payments = await DividendPayment.findAll({ where: { tenant_id }, transaction });
    const totalDividendsPaid = payments.reduce((sum, p) => sum + finance.units(p.amount), 0) / 100;

    return {
        proposed_capital: companyCapital,
        total_received: totalContributed,
        outstanding_capital: outstandingCapital,
        excess_capital: excessCapital,
        total_shareholders: totalShareholders,
        dividends_declared: totalDividendsDeclared,
        dividends_paid: totalDividendsPaid
      };
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getDashboardStats Error:', error);
    finance.error(res, error, 'Failed to fetch dashboard stats');
  }
};

// -----------------------------------------------------------------------------
// SHAREHOLDERS
// -----------------------------------------------------------------------------
exports.getShareholders = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const shareholders = await Shareholder.findAll({
      where: { tenant_id },
      include: [
        { model: CapitalTransaction, required: false, where: { tenant_id } }
      ],
      order: [['ownership_percentage', 'DESC']]
    });

    const companyCapital = await getCompanyCapital(tenant_id);

    // Calculate dynamic fields
    const enriched = shareholders.map(s => {
      const sh = finance.response(s, req.user);
      sh.required_capital = finance.prorate(Math.round(companyCapital * 100), finance.units(sh.ownership_percentage, 'Ownership percentage', true)) / 100;
      
      let contributed = 0;
      if (sh.CapitalTransactions) {
        sh.CapitalTransactions.forEach(t => {
          if (t.type === 'Adjustment') finance.fail('Historical adjustments need reconciliation before totals can be used.', 409);
          if (t.type === 'Contribution' || t.type === 'Advance') contributed += finance.units(t.amount, 'Historical capital amount');
          if (t.type === 'Refund') contributed -= finance.units(t.amount, 'Historical capital amount');
        });
      }
      contributed /= 100;
      sh.contributed_capital = contributed;
      sh.pending_capital = Math.max(0, sh.required_capital - contributed);
      sh.excess_capital = Math.max(0, contributed - sh.required_capital);
      return sh;
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('getShareholders Error:', error);
    finance.error(res, error, 'Failed to fetch shareholders');
  }
};



// -----------------------------------------------------------------------------
// CAPITAL TRANSACTIONS
// -----------------------------------------------------------------------------

exports.getCapitalTransactions = async (req, res) => {
  try {
    const transactions = await CapitalTransaction.findAll({
      where: { tenant_id: req.user.tenant_id },
      include: [
        { model: Shareholder, attributes: ['id', 'name'], where: { tenant_id: req.user.tenant_id }, required: false },
        { model: WalletAccount, attributes: ['id', 'name'], where: { tenant_id: req.user.tenant_id }, required: false }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });
    res.status(200).json({ success: true, data: transactions.map(row => finance.response(row, req.user)) });
  } catch (error) {
    console.error('getCapitalTransactions Error:', error);
    finance.error(res, error, 'Failed to fetch capital transactions');
  }
};

// -----------------------------------------------------------------------------
// DIVIDENDS
// -----------------------------------------------------------------------------

exports.getDividends = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const declarations = await DividendDeclaration.findAll({
      where: { tenant_id },
      include: [
        { 
          model: DividendDistribution, where: { tenant_id }, required: false,
          include: [{ model: Shareholder, attributes: ['id', 'name'], where: { tenant_id }, required: false }, { model: DividendPayment, where: { tenant_id }, required: false }]
        }
      ],
      order: [['declaration_date', 'DESC']]
    });
    res.status(200).json({ success: true, data: declarations.map(row => finance.response(row, req.user)) });
  } catch (error) {
    console.error('getDividends Error:', error);
    finance.error(res, error, 'Failed to fetch dividends');
  }
};


Object.assign(exports, require('./management-write.controller'));
