Ext.define('TSRow',{
    extend: 'Ext.data.Model',
    fields: [
        { name: '_ref', type:'string' },
        { name: 'ObjectID', type:'integer' },
        { name: 'Name', type:'string' },
        { name: 'Program', type:'boolean', defaultValue: false},
        { name: 'Velocity', type: 'number', defaultValue: 0},
        { name: 'PlanEstimate', type: 'number'},
        { name: 'PlannedVelocity', type:'number'},
        { name: 'TotalCount', type: 'number', defaultValue: 0},
        { name: 'AcceptedCount', type: 'number', defaultValue: 0},
        { name: 'CompletedCount', type:'number', defaultValue: 0},
        { name: 'TotalSize', type: 'number', defaultValue: 0},
        { name: 'AcceptedSize', type: 'number', defaultValue: 0},
        { name: 'CompletedSize', type:'number', defaultValue: 0},
        { name: 'SpillInCount', type: 'number', defaultValue: -1},
        { name: 'SpillOutCount', type: 'number', defaultValue: -1},
        { name: 'SpillInSize', type: 'number', defaultValue: -1},
        { name: 'SpillOutSize', type: 'number', defaultValue: -1},
        { name: 'Stories', type: 'object', defaultValue: [] }
    ],
    
    addStory: function(story) {
        console.log("Adding story to ", this.get('Name'));
        
        var stories = this.get('Stories') || [];
        stories.push(story);
        this.set('Stories', stories);
        
        var size = story.get('PlanEstimate') || 0;
        if ( !Ext.isEmpty(story.get('AcceptedDate')) ) { 
            this.addToField('Velocity', size);
            this.addToField('AcceptedSize', size);
            this.addToField('AcceptedCount', 1);
        }
        
        if ( story.get('ScheduleState') == "Completed" ) {
            this.addToField('CompletedCount', 1);
            this.addToField('CompletedSize',size);
        }
        
        if ( this._isSpillIn(story) ) {
            this.addToField('SpillInCount', 1);
            this.addToField('SpillInSize',size);
        }
        if ( this._isSpillOut(story) ) {
            this.addToField('SpillOutCount', 1);
            this.addToField('SpillOutSize',size);
        }
        
        this.addToField('TotalCount',1);
        this.addToField('TotalSize', size);
        
    },
    
    _isSpillIn: function(record) {
        var regex = new RegExp("^\\[Continued\\]", "i");
        return (regex.test(record.get('Name')) );
    },
    
    _isSpillOut: function(record) {
        var regex = new RegExp("^\\[Unfinished\\]", "i");
        return (regex.test(record.get('Name')) );
    },
    
    addToField: function(fieldname, delta) {
        return this.set(fieldname, this.get(fieldname) + delta);
    },
    
    resetToBase: function() {
        var changeable_fields = ['Velocity','PlannedVelocity',
            'TotalCount','AcceptedCount','CompletedCount',
            'TotalSize','AcceptedSize','CompletedSize',
            'SpillInCount','SpillOutCount','SpillInSize', 'SpillOutSize'];
        
        this.set('Stories',[]);
        
        Ext.Array.each(changeable_fields, function(field_name) {
            this.set(field_name,0);
        },this);
    }
});