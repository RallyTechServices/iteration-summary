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
            }
        });
        
        container.add({
            xtype: 'rallybutton',
            text: 'Go',
            margin: '10 10 10 10',
            defaultAlign: 'right',
            listeners: {
                click: this._updateData,
                scope: this
            }
        })

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
           function(){ return me._gatherBaseIterationInformationForRow(iteration_name, row); },
           function(){ return me._gatherFirstDayInformationForRow(iteration_name, row); },
           function(){ return me._gatherLastDayInformationForRow(iteration_name, row); },
           function(){ return me._gatherStoriesInIterationForRow(iteration_name, row); },
           function(){ return me._determineSpillOutPointsInIterationForRow(iteration_name, row); },
           function(){ return me._gatherScheduledInformationForRow(iteration_name, row); }
        ], this);

        // return Deft.Promise.all([
        //     me._gatherBaseIterationInformationForRow(iteration_name, row),
        //     me._gatherFirstDayInformationForRow(iteration_name, row),
        //     me._gatherLastDayInformationForRow(iteration_name, row),
        //     me._gatherStoriesInIterationForRow(iteration_name, row),
        //     me._determineSpillOutPointsInIterationForRow(iteration_name, row),
        //     me._gatherScheduledInformationForRow(iteration_name, row)
        // ], this);

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
            },
            sorters: [{property:'EndDate',direction:'DESC'}]
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

                //this._setPreviousIterations(row).then({
                //    success: function(row) {
                //        deferred.resolve(row);
                //    },
                //    failure: function(msg) {
                //        deferred.reject(msg);
                //    }
                //});
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    //_setPreviousIterations: function(row) {
    //    var deferred = Ext.create('Deft.Deferred');
    //
    //    var filters = [];
    //    if ( row.get('Iteration') ) {
    //        var iteration = row.get('Iteration');
    //        var start_date = iteration.get('StartDate');
    //        filters = [
    //            {property:'StartDate',operator:'<',value:Rally.util.DateTime.toIsoString(start_date)}
    //        ];
    //    } else {
    //        filters = [{property:'ObjectID',value:-1}]
    //    }
    //
    //    var config = {
    //        model: 'Iteration',
    //        filters: filters,
    //        limit: 2, //4,
    //        pageSize: 2, // 4,
    //        fetch: ['Name','ObjectID','PlanEstimate','PlannedVelocity','ChildrenPlannedVelocity','StartDate','EndDate'],
    //        context: {
    //            projectScopeUp: false,
    //            projectScopeDown: false,
    //            project: row.get('_ref')
    //        },
    //        sorters: [{property:'EndDate',direction:'DESC'}]
    //    };
    //
    //    TSUtilities.loadWsapiRecords(config).then({
    //        success: function(iterations) {
    //
    //            if ( iterations.length > 0 ) { row.set('IterationMinus1',iterations[0]); }
    //            if ( iterations.length > 1 ) { row.set('IterationMinus2',iterations[1]); }
    //           // if ( iterations.length > 2 ) { row.set('IterationMinus3',iterations[2]); }
    //           // if ( iterations.length > 3 ) { row.set('IterationMinus4',iterations[3]); }
    //            deferred.resolve(row);
    //        },
    //        failure: function(msg) {
    //            deferred.reject(msg);
    //        }
    //    });
    //
    //    return deferred.promise;
    //},
    
    _gatherFirstDayInformationForRow: function(iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var iteration = row.get('Iteration');
        var iteration_minus_1 = row.get('IterationMinus1');
        var iteration_minus_2 = row.get('IterationMinus2');
        // 
        var promises = [];
        Ext.Array.each([iteration,iteration_minus_1,iteration_minus_2],function(iteration){
            promises.push(function(){
               return me._getFirstDayInformationForIteration(iteration);
            });
            // promises.push(me._getFirstDayInformationForIteration(iteration));
        });
        
        Deft.Chain.sequence(promises,this).then({
        // Deft.Promise.all(promises,this).then({
        success: function(snapshot_groups) {
                Ext.Array.each(snapshot_groups, function(snapshots,idx) {
                    Ext.Array.each(snapshots, function(snapshot){
                        row.addToInitialPlanEstimate(snapshot.get('PlanEstimate') || 0 , idx);
                    });
                });
                
                deferred.resolve(row);
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _getFirstDayInformationForIteration: function(iteration) {
        var filters = [];
        if ( Ext.isEmpty(iteration) ) {
            filters.push( { property:'ObjectID', value: -1 } );
        } else {
            var iteration_oid =  iteration.get('ObjectID');
            var iteration_start = iteration.get('StartDate');
            var end_of_first_day = Rally.util.DateTime.add(iteration_start,'day',3);
            
            filters.push({property:'__At',value:Rally.util.DateTime.toIsoString(end_of_first_day)});
            filters.push({property:'Iteration',value:iteration_oid});
        }
        
        var config = {
            filters: filters,
            fetch: ['ObjectID','PlanEstimate']
        }
        return TSUtilities.loadLookbackRecords(config);
    },
    
    _gatherLastDayInformationForRow: function(iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');

        this._getLastDayInformationForIteration(row.get('Iteration')).then({
            success: function(snapshots) {
                this.logger.log('_getLastDayInformationForIteration success', snapshots);
                Ext.Array.each(snapshots, function(snapshot){
                    //console.log('snapshot:', snapshot.get('PlanEstimate') || 0 , idx);
                    row.addToFinalDayAccepted(snapshot.get('PlanEstimate') || 0 , 0);
                });
                row.updateAverageLastDayAccepted();
                deferred.resolve(row);
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });


        //var iterations = [
        //    row.get('Iteration')
        //    //row.get('IterationMinus1'),
        //    //row.get('IterationMinus2'),
        //    //row.get('IterationMinus3'),
        //    //row.get('IterationMinus4')
        //];
        //
        //var promises = [];
        //Ext.Array.each(iterations,function(iteration){
        //    promises.push(function(){
        //        return me._getLastDayInformationForIteration(iteration);
        //    });
        //});
        //
        //Deft.Chain.sequence(promises,this).then({
        //    success: function(snapshot_groups) {
        // //  console.log('snapshot groups:', snapshot_groups);
        //
        //        Ext.Array.each(snapshot_groups, function(snapshots,idx) {
        //            Ext.Array.each(snapshots, function(snapshot){
        //                //console.log('snapshot:', snapshot.get('PlanEstimate') || 0 , idx);
        //                row.addToFinalDayAccepted(snapshot.get('PlanEstimate') || 0 , idx);
        //            });
        //        });
        //        row.updateAverageLastDayAccepted();
        //        deferred.resolve(row);
        //    },
        //    failure: function(msg){
        //        deferred.reject(msg);
        //    }
        //});
        return deferred.promise;
    },
    
    _getLastDayInformationForIteration: function(iteration) {
        var filters = [];
        if ( Ext.isEmpty(iteration) ) {
            filters.push( { property:'ObjectID', value: -1 } );
        } else {
            var iteration_oid =  iteration.get('ObjectID');
            var iteration_end = iteration.get('EndDate');

            filters.push({property:'__At',value:Rally.util.DateTime.toIsoString(iteration_end)});
            filters.push({property:'Iteration',value:iteration_oid});
            filters.push({property:'ScheduleState',operator:'>=',value:'Accepted'});
        }

        var config = {
            filters: filters,
            fetch: ['ObjectID','PlanEstimate','FormattedID']
        };
        return TSUtilities.loadLookbackRecords(config);
    },
    //_getLastDayInformationForIteration: function(iteration) {
    //    var filters = [];
    //    if ( Ext.isEmpty(iteration) ) {
    //        filters.push( { property:'ObjectID', value: -1 } );
    //    } else {
    //        var iteration_oid =  iteration.get('ObjectID');
    //        var iteration_end = iteration.get('EndDate'),
    //            iteration_start = iteration.get('StartDate');
    //
    //        //add this filter if we only want items that were accepted before the iteration end date.
    //        //filters.push({property:'AcceptedDate', operator: '<', value:Rally.util.DateTime.toIsoString(iteration_end)});
    //        filters.push({property:'AcceptedDate', operator: '>', value:Rally.util.DateTime.toIsoString(iteration_start)});
    //        filters.push({property:'Iteration.ObjectID',value:iteration_oid});
    //    }
    //
    //    var config = {
    //        filters: filters,
    //        fetch: ['ObjectID','PlanEstimate','FormattedID'],
    //        model: 'HierarchicalRequirement',
    //        context: {project: null}
    //    };
    //    return TSUtilities.loadWsapiRecords(config);
    //},

    //Get scheduled information 3 days before the last day of iteration.
    _gatherScheduledInformationForRow: function(iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');

        this._getScheduledInformationForIteration(row.get('Iteration')).then({
            success: function(snapshots) {
                this.logger.log('_getLastDayInformationForIteration success', snapshots);
                Ext.Array.each(snapshots, function(snapshot){
                    row.addToScheduled3DaysPrior(snapshot.get('PlanEstimate') || 0 , 0); 
                    row.addToScheduled3DaysPriorCount(1 , 0); 
                });
                //row.updateAverageLastDayAccepted();
                deferred.resolve(row);
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred.promise;
    },
    
    _getScheduledInformationForIteration: function(iteration) {
        var filters = [];
        if ( Ext.isEmpty(iteration) ) {
            filters.push( { property:'ObjectID', value: -1 } );
        } else {
            var iteration_oid =  iteration.get('ObjectID');
            var iteration_end = iteration.get('EndDate');
            
            var three_days_prior = Rally.util.DateTime.add(iteration_end,'day',-3);

            filters.push({property:'__At',value:Rally.util.DateTime.toIsoString(three_days_prior)});
            filters.push({property:'Iteration',value:iteration_oid});
        }

        var config = {
            filters: filters,
            fetch: ['ObjectID','PlanEstimate','FormattedID']
        };
        return TSUtilities.loadLookbackRecords(config);
    },


    _gatherStoriesInIterationForRow: function( iteration_name, row ) {
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('_gatherStoriesInIterationForRow', iteration_name);
        var config = {
            model: 'UserStory',
            filters: [
                {property:'Iteration.Name',value:iteration_name}
            ],
            limit: Infinity,
            fetch: ['Name','ObjectID','PlanEstimate','AcceptedDate',
                'ScheduleState','CreationDate','Project'],
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
    
    // assumes _gatherStoriesInIterationForRow already run
    _determineSpillOutPointsInIterationForRow: function(iteration_name, row) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        this.logger.log('_determineSpillOutPointsInIterationForRow',iteration_name);
        var spill_out_stories = row.getSpillOutStories();

        var promises = [];
        Ext.Array.each( spill_out_stories, function(story){
            promises.push(function() { return me._findSplitPlanEstimate(story); });
            //promises.push(me._findSplitPlanEstimate(story));
        });
        
        if ( promises.length === 0 ) {
            return row;
        }
        
        Deft.Chain.sequence(promises,this).then({
        //Deft.Promise.all(promises, this).then({
            success:  function(stories) {
              //  console.log('stories that were spilled', stories);
                
                row.setSpilledOutStories(stories);
                deferred.resolve(row);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    /*
     * Guess plan estimate of original story before split by
     * looking at the stories that have _validFrom around the 
     * same time as the split story was created
     */
    _findSplitPlanEstimate: function(story){
        var deferred = Ext.create('Deft.Deferred');
        var time_variance = 2; // minutes
        
      //  console.log('_findSplitPlanEstimate', story);
        if ( story.get('PlanEstimate') > 0 ) {
            story.set('__OriginalPlanEstimate', story.get('PlanEstimate'));
            return story;
        }
        
        var timestamp = Rally.util.DateTime.fromIsoString(story.get('CreationDate'));
        var lower_ts = Rally.util.DateTime.add(timestamp,'minute',-1 * time_variance);
        var upper_ts = Rally.util.DateTime.add(timestamp,'minute',time_variance);
        var storyName = story.get('Name');
        storyName = storyName.replace('[Unfinished]','[Continued]');
        
        var config = {
            find: {
                '_TypeHierarchy':'HierarchicalRequirement',
                'Project': story.get('Project').ObjectID,
                '_ValidFrom': {
                    '$gt': Rally.util.DateTime.toIsoString(lower_ts),
                    '$lt': Rally.util.DateTime.toIsoString(upper_ts)
                }
            },
            fetch: ['ObjectID','PlanEstimate','_ValidFrom','FormattedID','Name']
        };
        
        TSUtilities.loadLookbackRecords(config).then({
            success: function(snaps) {
                Ext.Array.each(snaps,function(snap){
                    if ( snap.get('PlanEstimate') > 0 ) {
                        if (storyName.includes(snap.get('Name'))){
                            story.set('__OriginalPlanEstimate', snap.get('PlanEstimate'));
                        }
                    }
                });
                deferred.resolve(story);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
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
                  //  console.log(result);
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
     //   console.log("Rows:", rows);
        
        this.logger.log("Made store, about to make grid", store);
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this._getColumns(),
            showRowActionsColumn: false,
            viewConfig: {
                listeners: {
                    cellclick: this.showDetails,
                    scope: this
                }
            }
        });
        
        this.down('#export_button').setDisabled(false);
    },
    showDetails: function(view, cell, cellIndex, record) {
        this.logger.log('showDetails', view, record);

        var clickedDataIndex = view.panel.headerCt.getHeaderAtIndex(cellIndex).dataIndex;
        var cellValue = record.get(clickedDataIndex);

        this.logger.log('showDetails', cellValue, record.get('Stories'));
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
        //{
        //    text: 'Velocity',
        //    columns: [{
        //        text: 'Story Points',
        //        columns: [
        //            { dataIndex:'_TotalLastDayAccepted', text: 'Velocity', draggable: false, hideable: false, renderer: this.velocityRenderer},
        //            //kc - uncomment to show average for last 3
        //           // { dataIndex:'_AverageLastDayAccepted', text: 'Average of Last 3 Sprints', draggable: false, hideable: false},
        //            //{ dataIndex:'_AverageLastDayAcceptedMinus1', text: 'Sprint -1 Velocity (Last Day)', draggable: false, hideable: false},
        //            //{ dataIndex:'_AverageLastDayAcceptedMinus2', text: 'Sprint -2 Velocity (Last Day)', draggable: false, hideable: false}
        //        ],
        //        draggable: false,
        //        hideable: false,
        //        sortable: false
        //    }],
        //    draggable: false,
        //    hideable: false,
        //    sortable: false
        //},
        {
            text: 'Capacity Planning',
            columns: [{ 
                text: 'Story Points',
                columns: [
                    { dataIndex:'_TotalLastDayAccepted', text: 'Velocity', draggable: false, hideable: false, renderer: this.velocityRenderer},
                    { dataIndex:'_TotalPlannedVelocity', text:'Available', draggable: false, hideable: false},
                    //{ dataIndex:'_TotalPlanEstimate', text: 'Plan Estimate', draggable: false, hideable: false}
                    { dataIndex:'_TotalFirstDayPlanEstimate', text: 'Planned', draggable: false, hideable: false}
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
                    { dataIndex: '_TotalScheduled3DaysPriorCount', text: 'Scheduled', csvText: 'Total Count', draggable: false, hideable: false},
                    { dataIndex: 'CompletedCount', text: 'Completed', csvText: 'Completed Count', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedCount', text:'Accepted', csvText: 'Accepted Count', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            },
            { 
                text: 'Story Points',
                columns: [
                    { dataIndex: '_TotalScheduled3DaysPrior', text:'Scheduled', csvText:'Total Size', draggable: false, hideable: false},
                    { dataIndex: 'CompletedSize', text: 'Completed', csvText: 'Completed Size', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedSize', text: 'Accepted', csvText: 'Accepted Size', draggable: false, hideable: false}
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
    velocityRenderer: function(v,m,r){
        var iteration = r.get('Iteration');
        var endDate = iteration && iteration.get('EndDate') && Rally.util.DateTime.fromIsoString(iteration.get('EndDate'));
        if (endDate && endDate < new Date()){
            return v;
        }
        return '--';
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
