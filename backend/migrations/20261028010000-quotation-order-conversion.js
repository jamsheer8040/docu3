module.exports={up:async qi=>require('../utils/quotationOrderSchema')(qi.sequelize),down:async()=>{throw Error('Retain quotation/order references and confirmation history.');}};
