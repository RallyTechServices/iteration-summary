

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
        { name: 'IterationMinus1', type:'object'},
        { name: 'IterationMinus2', type:'object'},
        
        { name: '_TotalPlannedVelocity', type: 'number', defaultValue: 0},  // rolled up
        { name: '_TotalPlanEstimate', type: 'number', defaultValue: 0}, // rolled up
        { name: '_TotalFirstDayPlanEstimate', type: 'number', defaultValue: 0},
        { name: '_TotalFirstDayPlanEstimateMinus1', type: 'number', defaultValue: 0},
        { name: '_TotalFirstDayPlanEstimateMinus2', type: 'number', defaultValue: 0},
        
        { name: '_TotalLastDayAccepted', type:'number', defaultValue: 0 }, // rolled up
        { name: '_TotalLastDayAcceptedMinus1', type:'number', defaultValue: 0 }, // rolled up
        { name: '_TotalLastDayAcceptedMinus2', type:'number', defaultValue: 0 }, // rolled up
        
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
    
    addToInitialPlanEstimate: function(value,iteration_index) {
        var new_value = value || 0;
        var fields = ['_TotalFirstDayPlanEstimate','_TotalFirstDayPlanEstimateMinus1','_TotalFirstDayPlanEstimateMinus2'];
        var field = fields[iteration_index];
        
        var current = this.get(field) || 0;
        
        this.set(field, current + new_value );
        
        if ( this.get('Parent') ) {
            this.get('Parent').addToInitialPlanEstimate(value,iteration_index); 
        }
        
    },
    
    addToFinalDayAccepted: function(value,iteration_index) {
        var new_value = value || 0;
        var fields = ['_TotalLastDayAccepted','_TotalLastDayAcceptedMinus1','_TotalLastDayAcceptedMinus2'];
        var field = fields[iteration_index];

     //   console.log('adding ', value, 'to', field, iteration_index);
        
        var current = this.get(field) || 0;
        this.set(field, current + new_value );
        
        if ( this.get('Parent') ) {
            this.get('Parent').addToFinalDayAccepted(value,iteration_index); 
        }
        
    },
    
    getSpillOutStories: function() {
        var me = this,
            stories = this.get('Stories') || [];
        
        var spill_out_stories = Ext.Array.filter(stories, function(story){
            return ( me.isSpillOut(story) ) ;
        });
     //   console.log('spill_out_stories', spill_out_stories);
        return spill_out_stories;
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
        
        if ( this.isSpillIn(story) ) {
            this.addToField('SpillInCount', 1);
            this.addToField('SpillInSize',size);
        }
//        if ( this.isSpillOut(story) ) {
//            this.addToField('SpillOutCount', 1);
//            this.addToField('SpillOutSize',size);
//        }
//        
        this.addToField('TotalCount',1);
        this.addToField('TotalSize', size);
        this.addToField('_TotalPlanEstimate', size);
        
        if ( this.get('Parent') ) {
            this.get('Parent').addStory(story); 
        }
    },
    
    setSpilledOutStories: function(stories){
        var me = this;
        Ext.Array.each(stories, function(story){
            var size = story.get('__OriginalPlanEstimate') || 0;
       //     console.log('adding to spill out size', size);

            me.addToField('SpillOutCount', 1);
            me.addToField('SpillOutSize',size);
        });
    },

    isSpillIn: function(record) {
        var regex = new RegExp("^\\[Continued\\]", "i");
        return (regex.test(record.get('Name')) );
    },
    
    
    isSpillOut: function(record) {
        var regex = new RegExp("^\\[Unfinished\\]", "i");
    //    console.log('isSpillOut', record.get('Name'), regex.test(record.get('Name')), record.getData());
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
            
            '_TotalPlannedVelocity','_TotalPlanEstimate',
            '_TotalFirstDayPlanEstimate','_TotalFirstDayPlanEstimateMinus1','_TotalFirstDayPlanEstimateMinus2',
            '_TotalLastDayAccepted','_TotalLastDayAcceptedMinus1','_TotalLastDayAcceptedMinus2'
        ];
        
        
        this.set('Stories',[]);
        
        Ext.Array.each(changeable_fields, function(field_name) {
            this.set(field_name,0);
        },this);
    }
});