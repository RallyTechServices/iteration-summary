

Ext.define('TSRow',{
    extend: 'Ext.data.Model',
    fields: [
        { name: '_ref', type:'string' },
        { name: 'ObjectID', type:'integer' },
        { name: 'Name', type:'string' },
        { name: 'Parent', type: 'object' },
        { name: 'Program', type:'boolean', defaultValue: false},
        { name: 'Velocity', type: 'number', defaultValue: 0},
        { name: 'PlanEstimate', type: 'number'}, // current value of this specific sprint's scheduled items
        { name: 'PlannedVelocity', type:'number'}, // filled out on the sprint
        { name: 'ChildrenPlannedVelocity', type:'number'},
        { name: 'Iteration', type:'object'},
        
        { name: '_TotalPlannedVelocity', type: 'number', defaultValue: 0},  // rolled up
        { name: '_TotalPlanEstimate', type: 'number', defaultValue: 0}, // rolled up
        { name: '_TotalFirstDayPlanEstimate', type: 'number', defaultValue: 0},
        
        { name: '_TotalFinalDayAccepted', type:'number', defaultValue: 0 }, // rolled up
        
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
    
    addToInitialPlanEstimate: function(value) {
        var new_value = value || 0;
        var current = this.get('_TotalFirstDayPlanEstimate') || 0;
        this.set('_TotalFirstDayPlanEstimate', current + new_value );
        
        if ( this.get('Parent') ) {
            this.get('Parent').addToInitialPlanEstimate(value); 
        }
        
    },
    
    addToFinalDayAccepted: function(value) {
        var new_value = value || 0;
        var current = this.get('_TotalFinalDayAccepted') || 0;
        this.set('_TotalFinalDayAccepted', current + new_value );
        
        if ( this.get('Parent') ) {
            this.get('Parent').addToFinalDayAccepted(value); 
        }
        
    },
    
    addStory: function(story) { 
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
        this.addToField('_TotalPlanEstimate', size);
        
        if ( this.get('Parent') ) {
            this.get('Parent').addStory(story); 
        }
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
            'SpillInCount','SpillOutCount','SpillInSize', 'SpillOutSize',
            
            '_TotalPlannedVelocity','_TotalPlanEstimate','_TotalFirstDayPlanEstimate'];
        
        
        this.set('Stories',[]);
        
        Ext.Array.each(changeable_fields, function(field_name) {
            this.set(field_name,0);
        },this);
    }
});