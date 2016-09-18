Ext.define("TSIterationSummary", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSIterationSummary"
    },
                        
    launch: function() {
        var me = this;
        this.setLoading('Fetching Projects...');
        this._loadProjects().then({
            success: function(projects) {
                this.rows = Ext.Array.map(projects, function(project){
                    return Ext.create('TSRow', project.getData());
                });
                
                if ( this.rows.length === 0 ) { return; }

                this._addSelectors(this.down('#selector_box'), projects);
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
            },
            scope: this
        }).always(function(){ me.setLoading(false);});
    },
    
    _addSelectors: function(container, projects){
        var context = { project:this.getContext().getProjectRef() };
        if ( this.rows[0].get('_ref') !=  context.project ) {
            context = {
                project: this.rows[0].get('_ref')
            }
        }
        
        context.projectScopeDown = false;
        context.projectScopeUp = false;
        
        this.iteration_selector = container.add({ 
            xtype:'rallyiterationcombobox',
            fieldLabel: 'Iteration:',
            margin: 10,
            labelWidth: 45,
            allowClear: false,
            storeConfig: {
                limit: Infinity,
                context: context,
                remoteFilter: false,
                autoLoad: true
            },
            listeners: {
                scope: this,
                change: this._updateData
            }
        });
    },
    
    _updateData: function() {
        this.down('#display_box').removeAll();
        if ( Ext.isEmpty(this.iteration_selector) ) {
            return;
        }
        Ext.Array.each(this.rows, function(row) {
            row.resetToBase();
        });
        
        var iteration = this.iteration_selector.getRecord().get('Name');
        
        this._gatherIterationInformation(iteration,this.rows);
    },
    
    _gatherIterationInformation: function(iteration,rows){
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        var promises = [];
        
        // CAUTION: expecting the function calls to modify the item in the array in place
        Ext.Array.each(rows, function(row){
            promises.push(function(){
                return me._gatherIterationInformationForRow(iteration,row);
            });
        });
        
        this.setLoading("Gathering Iterations...");
        Deft.Chain.sequence(promises,me).then({
            success: function(results) {
                this._makeGrid(rows);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
            scope: this
        }).always(function(){ me.setLoading(false); });
        
        return deferred.promise;
    },
    
    _gatherIterationInformationForRow: function(iteration_name,row){
        var me = this;
        return Deft.Chain.sequence([
            function() { return me._gatherInitialIterationInformationForRow(iteration_name, row); },
            function() { return me._gatherStoriesInIterationForRow(iteration_name, row); }
        ], this);
    },
    
    _gatherInitialIterationInformationForRow: function(iteration_name,row) {
        var deferred = Ext.create('Deft.Deferred');
        var config = {
            model: 'Iteration',
            filters: [
                {property:'Name',value:iteration_name},
                {property:'Project.ObjectID',value:row.get('ObjectID')}
            ],
            limit: 1,
            pageSize: 1,
            fetch: ['Name','ObjectID','PlanEstimate','PlannedVelocity'],
            context: {
                projectScopeUp: false,
                projectScopeDown: false,
                project: row.get('_ref')
            }
        };
        
        this._loadWsapiRecords(config).then({
            success: function(iterations) {
                var iteration = iterations[0];
                if ( Ext.isEmpty(iteration) ) {
                    row.set('PlanEstimate', 'N/A');
                    row.set('PlannedVelocity', 'N/A');
                } else {
                    row.set('PlanEstimate',iteration.get('PlanEstimate'));
                    row.set('PlannedVelocity',iteration.get('PlannedVelocity'));
                }
                deferred.resolve(row);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _gatherStoriesInIterationForRow: function( iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');
        var config = {
            model: 'UserStory',
            filters: [
                {property:'Iteration.Name',value:iteration_name}
            ],
            limit: 1,
            pageSize: 1,
            fetch: ['Name','ObjectID','PlanEstimate','AcceptedDate','ScheduleState'],
            context: {
                projectScopeUp: false,
                projectScopeDown: true,
                project: row.get('_ref')
            }
        };
        
        this._loadWsapiRecords(config).then({
            success: function(stories) {
                Ext.Array.each(stories, function(story) {
                    row.addStory(story);
                });
                deferred.resolve(row);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _loadProjects: function() {
        var programs = this.getSetting('showPrograms');
        this.setLoading('Fetching Projects...');
        
        if ( Ext.isEmpty(programs) || programs == {} || programs == "{}") {
            var config = {
                model:'Project',
                filters: [{property:'Parent',value: this.getContext().getProjectRef()}],
                fetch:['Name','Parent','ObjectID']
            };
        
            return this._loadWsapiRecords(config);
        } 
        
        return this._loadProgramsAndProjects(programs);
    },
    
    _loadProgramsAndProjects: function(programs) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        if ( Ext.isString(programs) ) { programs = Ext.JSON.decode(programs); }
        
        console.log('programs', programs);
        var promises = [];
        Ext.Object.each(programs, function(ref, program){
            promises.push(function() {
                program.Program = true;
                return Ext.create('TSRow', program);
            });
            
            var config = {
                model:'Project',
                filters: [{property:'Parent',value: ref}],
                fetch:['Name','Parent','ObjectID']
            };
            promises.push(function() {
                return me._loadWsapiRecords(config);
            });
        });
        
        Deft.Chain.sequence(promises,this).then({
            success: function(results) {
                deferred.resolve(Ext.Array.flatten(results));
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred;
    },
      
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _makeGrid: function(rows){
        var store = Ext.create('Rally.data.custom.Store',{data: rows});
        this.logger.log("Rows: ", rows);
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn : false,
            columnCfgs: this._getColumns()
        });
    },
    
    _getColumns: function() {
        return [
        { 
            dataIndex:'Name', text:'Program/Team', draggable: false, hideable: false,
            draggable: false, 
            hideable: false,
            sortable: false,
            renderer: function(value,meta,record) {
                var prefix = "";
                if ( !record.get('Program') ) {
                    prefix = "&nbsp;&nbsp;&nbsp;&nbsp;";
                }
                return prefix + value;
            }
        },
        {
            text: 'Velocity',
            columns: [{ 
                text: 'Story Points',
                columns: [
                    { dataIndex:'Velocity', text: 'Velocity', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            }],
            draggable: false, 
            hideable: false,
            sortable: false
        },
        {
            text: 'Capacity Planning',
            columns: [{ 
                text: 'Story Points',
                columns: [
                    { dataIndex:'PlannedVelocity', text:'Planned Velocity', draggable: false, hideable: false},
                    { dataIndex:'PlanEstimate', text: 'Plan Estimate', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            }],
            draggable: false, 
            hideable: false,
            sortable: false
            
        },
        {
            text: 'Story Acceptance',
            columns: [{ 
                text: 'Story Count',
                columns: [
                    { dataIndex: 'TotalCount', text: 'Total Planned', csvText: 'Total Count', draggable: false, hideable: false},
                    { dataIndex: 'CompletedCount', text: 'Completed State', csvText: 'Completed Count', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedCount', text:'Accepted State', csvText: 'Accepted Count', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            },
            { 
                text: 'Story Points',
                columns: [
                    { dataIndex: 'TotalSize', text:'Total Planned', csvText:'Total Size', draggable: false, hideable: false},
                    { dataIndex: 'CompletedSize', text: 'Completed State', csvText: 'Completed Size', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedSize', text: 'Accepted State', csvText: 'Accepted Size', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            }],
            draggable: false, 
            hideable: false,
            sortable: false
        },
        {
            text: 'Spill-over',
            columns: [{ 
                text: 'Story Count',
                columns: [
                    { dataIndex: 'SpillInCount', text: 'In', csvText: 'In Count', draggable: false, hideable: false},
                    { dataIndex: 'SpillOutCount', text: 'Out', csvText: 'Out Count', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            },
            { 
                text: 'Story Points',
                columns: [
                    { dataIndex: 'SpillInSize', text: 'In', csvText: 'In Size', draggable: false, hideable: false},
                    { dataIndex: 'SpillOutSize', text: 'Out', csvText: 'Out Size', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            }],
            draggable: false, 
            hideable: false,
            sortable: false
        }];
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [{
            name: 'showPrograms',
            xtype:'tsprojectsettingsfield',
            fieldLabel: ' ',
            readyEvent: 'ready'
        }];
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
