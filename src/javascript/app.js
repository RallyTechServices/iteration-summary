Ext.define("TSIterationSummary", {
    extend: 'Rally.app.App',
    componentCls: 'tsapp',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    items: [
        {xtype:'container',itemId:'selector_box', layout: 'hbox'},
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
                this.rows = projects;
                
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
        
        container.add({xtype:'container',flex:1});
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: this._export
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
            function() { return me._gatherBaseIterationInformationForRow(iteration_name, row); },
            function() { return me._gatherFirstDayInformationForRow(iteration_name, row); },
            function() { return me._gatherLastDayInformationForRow(iteration_name, row); },
            function() { return me._gatherStoriesInIterationForRow(iteration_name, row); }
        ], this);
    },
    
    _gatherBaseIterationInformationForRow: function(iteration_name,row) {
        var deferred = Ext.create('Deft.Deferred');
        var config = {
            model: 'Iteration',
            filters: [
                {property:'Name',value:iteration_name},
                {property:'Project.ObjectID',value:row.get('ObjectID')}
            ],
            limit: 1,
            pageSize: 1,
            fetch: ['Name','ObjectID','PlanEstimate','PlannedVelocity','ChildrenPlannedVelocity','StartDate','EndDate'],
            context: {
                projectScopeUp: false,
                projectScopeDown: false,
                project: row.get('_ref')
            }
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            success: function(iterations) {
                var iteration = iterations[0];
                if ( Ext.isEmpty(iteration) ) {
                    row.set('PlanEstimate', 'N/A');
                    row.set('PlannedVelocity', 'N/A');
                } else {
                    row.set('Iteration', iteration);
                    row.set('PlannedVelocity',iteration.get('PlannedVelocity'));
                    row.set('ChildrenPlannedVelocity',iteration.get('ChildrenPlannedVelocity'));
                    
                    var planned = iteration.get('PlannedVelocity') || 0;
                    var kid_planned = iteration.get('ChildrenPlannedVelocity') || 0;
                    
                    var total_planned = planned + kid_planned;
                    row.set('_TotalPlannedVelocity',total_planned);
                    
                }
                deferred.resolve(row);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _gatherFirstDayInformationForRow: function(iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');
        
        var iteration = row.get('Iteration');
        
        var filters = [];
        if ( Ext.isEmpty(iteration) ) {
            filters.push( { property:'ObjectID', value: -1 } );
        } else {
            var iteration_oid =  iteration.get('ObjectID');
            var iteration_start = iteration.get('StartDate');
            var end_of_first_day = Rally.util.DateTime.add(iteration_start,'day',1);
            
            filters.push({property:'__At',value:Rally.util.DateTime.toIsoString(end_of_first_day)});
            filters.push({property:'Iteration',value:iteration_oid});
        }
        
        var config = {
            filters: filters,
            fetch: ['ObjectID','PlanEstimate']
        }
        TSUtilities.loadLookbackRecords(config).then({
            success: function(snapshots) {
                Ext.Array.each(snapshots, function(snapshot){
                    row.addToInitialPlanEstimate(snapshot.get('PlanEstimate') || 0 );
                });
                
                deferred.resolve(row);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred.promise;
    },
    
    _gatherLastDayInformationForRow: function(iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');
        
        var iteration = row.get('Iteration');
        
        var filters = [];
        if ( Ext.isEmpty(iteration) ) {
            filters.push( { property:'ObjectID', value: -1 } );
        } else {
            var iteration_oid =  iteration.get('ObjectID');
            var iteration_end = iteration.get('EndDate');
            
            filters.push({property:'__At',value:Rally.util.DateTime.toIsoString(iteration_end)});
            filters.push({property:'Iteration',value:iteration_oid});
            filters.push({property:'ScheduleState',operator:'>=',value:'Accepted'})
        }
        
        var config = {
            filters: filters,
            fetch: ['ObjectID','PlanEstimate']
        }
        TSUtilities.loadLookbackRecords(config).then({
            success: function(snapshots) {
                Ext.Array.each(snapshots, function(snapshot){
                    row.addToFinalDayAccepted(snapshot.get('PlanEstimate') || 0 );
                });
                
                deferred.resolve(row);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
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
            limit: Infinity,
            fetch: ['Name','ObjectID','PlanEstimate','AcceptedDate','ScheduleState'],
            context: {
                projectScopeUp: false,
                projectScopeDown: false,
                project: row.get('_ref')
            }
        };
        
        TSUtilities.loadWsapiRecords(config).then({
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
                fetch:['Name','Parent','ObjectID'],
                sorters: [{property:'Name'}]
            };
        
            return TSUtilities.loadWsapiRecords(config);
        } 
        
        return this._loadProgramsAndProjects(programs);
    },
    
    _sortHashByProjectName: function(project_hash){
        
        var sorted_hash = {};
        
        var project_array = Ext.Object.getValues(project_hash); 
            
        var sorted_projects = Ext.Array.sort(project_array, function(a,b) {
            if ( a.Name < b.Name ) { return -1; }
            if ( a.Name > b.Name ) { return 1; }
            return 0;
        });
            
        Ext.Array.each(sorted_projects, function(project) {
            sorted_hash[project._ref] = project;
        });
                
        return sorted_hash;
    },
    
    _loadProgramsAndProjects: function(programs) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        if ( Ext.isString(programs) ) { programs = Ext.JSON.decode(programs); }
        
        programs = this._sortHashByProjectName(programs);
        
        var promises = [];
        Ext.Object.each(programs, function(ref, program){
            program.Program = true;
            var program_row = Ext.create('TSRow', program);
            
            promises.push(function() {
                return program_row;
            });
            
            var config = {
                model:'Project',
                filters: [{property:'Parent',value: ref}],
                fetch:['Name','Parent','ObjectID'],
                sorters: [{property:'Name'}]
            };
            promises.push(function() {
                return TSUtilities.loadWsapiRecords(config);
            });
        });
        
        Deft.Chain.sequence(promises,this).then({
            success: function(results) {
                var program = null;
                var items = Ext.Array.flatten(results);
                var rows = [];
                
                Ext.Array.each(items, function(result) {
                    console.log(result);
                    if (result.get('Program')) {
                        program = result;
                        rows.push(result);
                    } else {
                        var data = result.getData();
                        data.Parent = program;
                        var item = Ext.create('TSRow', data);
                        rows.push(item);
                    }
                });
                deferred.resolve(rows);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred;
    },
    
    _makeGrid: function(rows){
        var store = Ext.create('Rally.data.custom.Store',{data: rows});
        
        this.rows = rows;
        console.log("Rows:", rows);
        
        this.logger.log("Made store, about to make grid", store);
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this._getColumns(),
            showRowActionsColumn: false
        });
        
        this.down('#export_button').setDisabled(false);
    },
    
    _getColumns: function() {
        return [
        { 
            dataIndex:'Name', text:'Program/Team', draggable: false, hideable: false,
            draggable: false, 
            hideable: false,
            sortable: false,
            
            stateful: true,
            stateEvents: ['columnresize'],
            stateId: 'TSIterationSummary.gridsettings.4',
            
            renderer: function(value,meta,record) {
                var prefix = "";
                if ( !record.get('Program') ) {
                    prefix = "&nbsp;&nbsp;&nbsp;&nbsp;";
                }
                return prefix + value;
            },
            exportRenderer: function(value,meta,record) {
                var prefix = "";
                if ( !record.get('Program') ) {
                    prefix = "    ";
                }
                return prefix + value;
            }
        },
        {
            text: 'Velocity',
            columns: [{ 
                text: 'Story Points',
                columns: [
                    { dataIndex:'_TotalFinalDayAccepted', text: 'Sprint Velocity (Last Day)', draggable: false, hideable: false}
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
                    { dataIndex:'_TotalPlannedVelocity', text:'Planned Velocity', draggable: false, hideable: false},
                    //{ dataIndex:'_TotalPlanEstimate', text: 'Plan Estimate', draggable: false, hideable: false}
                    { dataIndex:'_TotalFirstDayPlanEstimate', text: 'First Day Plan Estimate', draggable: false, hideable: false}
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
                    { dataIndex: 'TotalCount', text: 'Total Scheduled', csvText: 'Total Count', draggable: false, hideable: false},
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
                    { dataIndex: 'TotalSize', text:'Total Scheduled', csvText:'Total Size', draggable: false, hideable: false},
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
    },
    
    _export: function(){
        var me = this;
        this.logger.log('_export');
        
        var grid = this.down('rallygrid');
        var rows = this.rows;
        
        this.logger.log('number of rows:', rows.length);
        
        if ( !grid && !rows ) { return; }
        
        var filename = 'iteration-summary.csv';

        this.logger.log('saving file:', filename);
        
        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromRows(this,grid,rows); } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    }
    
});
