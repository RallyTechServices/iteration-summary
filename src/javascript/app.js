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
        this._getProjects().then({
            success: function(projects) {
                this.rows = Ext.Array.map(projects, function(project){
                    return Ext.create('TSRow', project.getData());
                });
                
                this._addSelectors(this.down('#selector_box'));
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
            },
            scope: this
        }).always(function(){ me.setLoading(false);});
    },
    
    _addSelectors: function(container){
        this.iteration_selector = container.add({ 
            xtype:'rallyiterationcombobox',
            fieldLabel: 'Iteration:',
            margin: 10,
            labelWidth: 45,
            allowClear: false,
            
            listeners: {
                scope: this,
                change: this._updateData
            }
        });
    },
    
    _updateData: function() {
        var iteration = this.iteration_selector.getRecord().get('Name');
        this.down('#display_box').removeAll();
        
        this._gatherIterationInformation(iteration,this.rows);
    },
    
    _gatherIterationInformation: function(iteration,rows){
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        var promises = [];
        
        Ext.Array.each(rows, function(row){
            promises.push(function(){
                return me._gatherIterationInformationForRow(iteration,row);
            });
        });
        
        this.setLoading("Gathering Iterations...");
        Deft.Chain.sequence(promises,me).then({
            success: function(rows) {
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
        var deferred = Ext.create('Deft.Deferred');
        
        var config = {
            model: 'Iteration',
            filters: [
                {property:'Name',value:iteration_name},
                {property:'Project.ObjectID',value:row.get('ObjectID')}
            ],
            limit: 1,
            pageSize: 1,
            fetch: ['Name','ObjectID','PlanEstimate','PlannedVelocity']
        };
        
        this._loadWsapiRecords(config).then({
            success: function(iterations) {
                var iteration = iterations[0];
                row.set('PlanEstimate',iteration.get('PlanEstimate'));
                row.set('PlannedVelocity',iteration.get('PlannedVelocity'));
                deferred.resolve(row);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _getProjects: function() {
        var config = {
            model:'Project',
            filters: [{property:'Parent',value: this.getContext().getProjectRef()}],
            fetch:['Name','Parent','ObjectID']
        };
        
        return this._loadWsapiRecords(config);
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
            text: 'Program&nbsp;Information',
            columns: [
                { dataIndex:'Name', text:'Program/Team', draggable: false, hideable: false}
            ],
            draggable: false, 
            hideable: false,
            sortable: false,
            width: 250
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
                    { dataIndex:'PlanEstimate', text: 'Plan Estimate', draggable: false, hideable: false},
                    { dataIndex:'PlannedVelocity', text:'Planned Velocity', draggable: false, hideable: false}
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
                text: 'Story Count',
                columns: [
                    { dataIndex: 'TotalCount', text: 'Total', csvText: 'Total Count', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedCount', text:'Accepted', csvText: 'Accepted Count', draggable: false, hideable: false},
                    { dataIndex: 'CompletedCount', text: 'Completed', csvText: 'Completed Count', draggable: false, hideable: false}
                ],
                draggable: false, 
                hideable: false,
                sortable: false
            },
            { 
                text: 'Story Points',
                columns: [
                    { dataIndex: 'TotalSize', text:'Total', csvText:'Total Size', draggable: false, hideable: false},
                    { dataIndex: 'AcceptedSize', text: 'Accepted', csvText: 'Accepted Size', draggable: false, hideable: false},
                    { dataIndex: 'CompletedSize', text: 'Completed', csvText: 'Completed Size', draggable: false, hideable: false}
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
