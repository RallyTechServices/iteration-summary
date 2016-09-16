Ext.define('TSRow',{
    extend: 'Ext.data.Model',
    fields: [
        { name: '_ref', type:'string' },
        { name: 'ObjectID', type:'integer' },
        { name: 'Name', type:'string' },
        { name: 'Program', type:'boolean', defaultValue: false},
        { name: 'Velocity', type: 'number', defaultValue: -1},
        { name: 'PlanEstimate', type: 'number'},
        { name: 'PlannedVelocity', type:'number'},
        { name: 'TotalCount', type: 'number', defaultValue: -1},
        { name: 'AcceptedCount', type: 'number', defaultValue: -1},
        { name: 'CompletedCount', type:'number', defaultValue: -1},
        { name: 'TotalSize', type: 'number', defaultValue: -1},
        { name: 'AcceptedSize', type: 'number', defaultValue: -1},
        { name: 'CompletedSize', type:'number', defaultValue: -1},
        { name: 'SpillInCount', type: 'number', defaultValue: -1},
        { name: 'SpillOutCount', type: 'number', defaultValue: -1},
        { name: 'SpillInSize', type: 'number', defaultValue: -1},
        { name: 'SpillOutSize', type: 'number', defaultValue: -1}
    ]
});