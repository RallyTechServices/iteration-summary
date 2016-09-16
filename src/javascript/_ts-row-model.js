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
        { name: 'SpillOutSize', type: 'number', defaultValue: -1},
        { name: 'Stories', type: 'object', defaultValue: [] }
    ],
    
    addStory: function(story) {
        var stories = this.get('Stories') || [];
        stories.push(story);
        
        var size = story.get('PlanEstimate') || 0;
        if ( !Ext.isEmpty(story.get('AcceptedDate')) ) { 
            this.addToField('Velocity', size);
            this.addToField('AcceptedCount', 1);
        }
        
        this.addToField('TotalCount',1);
        this.addToField('TotalSize', size);
        
    },
    
    addToField: function(fieldname, delta) {
        return this.set(fieldname, this.get(fieldname) + delta);
    }
});