const {DataTypes}=require('sequelize');
module.exports=async sequelize=>{
 const qi=sequelize.getQueryInterface();
 const add=async(table,fields)=>{const columns=await qi.describeTable(table);for(const [name,definition]of Object.entries(fields))if(!columns[name])await qi.addColumn(table,name,definition);};
 await add('quotations',{sales_order_id:{type:DataTypes.BIGINT,allowNull:true}});
 const quoteColumns=await qi.describeTable('quotations');
 if(!String(quoteColumns.status.type).includes("'SO'"))await qi.changeColumn('quotations','status',{type:DataTypes.ENUM('Draft','Sent','Accepted','Declined','Expired','SO'),allowNull:false,defaultValue:'Draft'});
 await add('sales_orders',{
  source_quotation_id:{type:DataTypes.INTEGER,allowNull:true},lead_id:{type:DataTypes.INTEGER,allowNull:true},recipient_snapshot:{type:DataTypes.JSON,allowNull:true},
  confirmation_status:{type:DataTypes.ENUM('Unconfirmed','Confirmed','Cancelled'),allowNull:false,defaultValue:'Confirmed'},
  notes:{type:DataTypes.TEXT,allowNull:true},template_style:{type:DataTypes.STRING(20),allowNull:true},document_footer:{type:DataTypes.TEXT,allowNull:true}
 });
 const orderColumns=await qi.describeTable('sales_orders');
 if(!orderColumns.customer_id.allowNull)await qi.changeColumn('sales_orders','customer_id',{type:DataTypes.INTEGER,allowNull:true});
 if(String(orderColumns.customer_reference.type).includes('(100)'))await qi.changeColumn('sales_orders','customer_reference',{type:DataTypes.STRING(150),allowNull:true});
 await add('sales_order_items',{expected_date:{type:DataTypes.DATEONLY,allowNull:true}});
 const indexes=await qi.showIndex('sales_orders');
 if(!indexes.some(i=>i.name==='one_order_per_quotation'))await qi.addIndex('sales_orders',['tenant_id','source_quotation_id'],{unique:true,name:'one_order_per_quotation'});
};
