Ext.define('CA.technicalservices.ProjectTreePickerSettingsField',{
    extend: 'Ext.form.field.Base',
    alias: 'widget.tsprojectsettingsfield',
    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',
    width: '100%',
    cls: 'column-settings',

    store: undefined,
    labelAlign: 'top',
    
    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },
    
    initComponent: function(){

        this.callParent();
        this.addEvents('ready');

        this.setLoading('loading...');
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name','ObjectID'],
            //filters: [{property:'ObjectID', value: -1 }],
            pageSize: 2000,
            limit: 'Infinity'
        });
        store.load({
            scope: this,
            callback: this._buildProjectGrid
        });

    },

    onRender: function() {
        this.callParent(arguments);
        this.setLoading('Loading projects...');
    },
        
    _buildProjectGrid: function(records, operation, success){
        this.setLoading(false);
        var container = Ext.create('Ext.container.Container',{
            layout: { type:'hbox' },
            renderTo: this.inputEl,
            minHeight: 50,
            minWidth: 50
        });
        
        var decodedValue = {};
        
        if (this.initialConfig && this.initialConfig.value && !_.isEmpty(this.initialConfig.value)){
            if (!Ext.isObject(this.initialConfig.value)){
                decodedValue = Ext.JSON.decode(this.initialConfig.value);
            } else {
                decodedValue = this.initialConfig.value;
            }
        }
       
        var data = [],
            empty_text = "No selections";

        console.log('initial config', this._value, this.initialConfig, decodedValue);
            
        if (success && decodedValue !== {} ) {
            Ext.Array.each(records, function(project){
                var setting = decodedValue[project.get('_ref')];
                if ( setting && setting !== {} ) {
                    data.push({
                        _ref: project.get('_ref'), 
                        projectName: project.get('Name'),
                        Name: project.get('Name'),
                        ObjectID: project.get('ObjectID')
                    });
                }
            });
        } else {
            empty_text = "Error(s) fetching Project data: <br/>" + operation.error.errors.join('<br/>');
        }

        var custom_store = Ext.create('Ext.data.Store', {
            fields: ['_ref', 'projectName','Name', 'ObjectID'],
            data: data
        });
        
        var gridWidth = Math.min(this.inputEl.getWidth(true)-100, 500);
        this.inputEl.set
        this._grid = container.add(  {
            xtype:'rallygrid',
            autoWidth: true,
            columnCfgs: this._getColumnCfgs(),
            showRowActionsColumn:false,
            showPagingToolbar: false,
            store: custom_store,
            height: 150,
            width: gridWidth,
            emptyText: empty_text,
            editingConfig: {
                publishMessages: false
            }
        });

        var width = Math.min(this.inputEl.getWidth(true)-20, 600);
        
        //Ext.create('Rally.ui.Button',{
        container.add({
            xtype: 'rallybutton',
            text: 'Select Programs',
            margin: '0 0 0 10',
            listeners: {
                scope: this,
                click: function(){

                    Ext.create('CA.technicalservices.ProjectTreePickerDialog',{
                        autoShow: true,
                        width: width,
                        selectedRefs: _.pluck(data, '_ref'),
                        listeners: {
                            scope: this,
                            itemschosen: function(items){
                                var new_data = [],
                                    store = this._grid.getStore();

                                Ext.Array.each(items, function(item){
                                    if (!store.findRecord('_ref',item.get('_ref'))){
                                        new_data.push({
                                            _ref: item.get('_ref'),
                                            projectName: item.get('Name'),
                                            Name: item.get('Name'),
                                            ObjectID: item.get('ObjectID')
                                        });
                                    }
                                });
                                this._grid.getStore().add(new_data);
                            }
                        }
                    });
                }
            }
        });

       this.fireEvent('ready', true);
    },
    _removeProject: function(){
        this.grid.getStore().remove(this.record);
    },
    _getColumnCfgs: function() {
        var me = this;

        var columns = [{
            xtype: 'rallyrowactioncolumn',
            scope: this,
            rowActionsFn: function(record){
                return  [
                    {text: 'Remove', record: record, handler: me._removeProject, grid: me._grid }
                ];
            }
        },
        {
            text: 'Program',
            dataIndex: '_ref',
            flex: 1,
            editor: false,
            renderer: function(v, m, r){
                return r.get('projectName');
            },
            getSortParam: function(v,m,r){
                return 'projectName';
            }
        }];
        return columns;
    },
    /**
     * When a form asks for the data this field represents,
     * give it the name of this field and the ref of the selected project (or an empty string).
     * Used when persisting the value of this field.
     * @return {Object}
     */
    getSubmitData: function() {
        var data = {};
        data[this.name] = Ext.JSON.encode(this._buildSettingValue());
        return data;
    },
    
    _buildSettingValue: function() {
        var mappings = {};
        var store = this._grid.getStore();

        store.each(function(record) {
            if (record.get('_ref')) {
                mappings[record.get('_ref')] = {
                    'Name': record.get('projectName') || "",
                    'ObjectID': record.get('ObjectID') || "",
                    '_ref': record.get('_ref') || ""
                }
            }
        }, this);
        return mappings;
    },

    getErrors: function() {
        var errors = [];
        //Add validation here
        return errors;
    },
    setValue: function(value) {
        console.log('setValue', value);
        this.callParent(arguments);
        this._value = value;
    }
});