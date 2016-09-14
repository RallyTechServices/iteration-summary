Ext.define('TSRow',{
    extend: 'Ext.data.Model',
    fields: [
        { name: 'ObjectID', type:'integer' },
        { name: 'Name', type:'string' },
        { name: 'PlanEstimate', type: 'integer'},
        { name: 'PlannedVelocity', type:'integer'}
    ]
});