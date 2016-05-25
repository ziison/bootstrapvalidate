/*!
 * BootstrapValidator (http://bootstrapvalidator.com)
 * The best jQuery plugin to validate form fields. Designed to use with Bootstrap 3
 *
 * @version     v0.5.1-dev, built on 2014-07-23 6:05:15 AM
 * @author      https://twitter.com/nghuuphuoc
 * @copyright   (c) 2013 - 2014 Nguyen Huu Phuoc
 * @license     MIT
 */
(function($) {
    var BootstrapValidator = function(form, options) {
        this.$form   = $(form);
        this.options = $.extend({}, $.fn.bootstrapValidator.DEFAULT_OPTIONS, options);

        this.$invalidFields = $([]);    // Array of invalid fields
        this.$submitButton  = null;     // The submit button which is clicked to submit form

        // Validating status
        this.STATUS_NOT_VALIDATED = 'NOT_VALIDATED';
        this.STATUS_VALIDATING    = 'VALIDATING';
        this.STATUS_INVALID       = 'INVALID';
        this.STATUS_VALID         = 'VALID';

        // Determine the event that is fired when user change the field value
        // Most modern browsers supports input event except IE 7, 8.
        // IE 9 supports input event but the event is still not fired if I press the backspace key.
        // Get IE version
        // https://gist.github.com/padolsey/527683/#comment-7595
        var ieVersion = (function() {
            var v = 3, div = document.createElement('div'), a = div.all || [];
            while (div.innerHTML = '<!--[if gt IE '+(++v)+']><br><![endif]-->', a[0]) {}
            return v > 4 ? v : !v;
        }());

        var el = document.createElement('div');
        this._changeEvent = (ieVersion === 9 || !('oninput' in el)) ? 'keyup' : 'input';

        // The flag to indicate that the form is ready to submit when a remote/callback validator returns
        this._submitIfValid = null;

        // Field elements
        this._cacheFields = {};

        this._init();
    };

    BootstrapValidator.prototype = {
        constructor: BootstrapValidator,

        /**
         * Init form
         */
        _init: function() {
            var that    = this,
                options = {
                    excluded:       this.$form.attr('data-bv-excluded'),
                    trigger:        this.$form.attr('data-bv-trigger'),
                    message:        this.$form.attr('data-bv-message'),
                    container:      this.$form.attr('data-bv-container'),
                    group:          this.$form.attr('data-bv-group'),
                    submitButtons:  this.$form.attr('data-bv-submitbuttons'),
                    threshold:      this.$form.attr('data-bv-threshold'),
                    live:           this.$form.attr('data-bv-live'),
                    onSuccess:      this.$form.attr('data-bv-onsuccess'),
                    onError:        this.$form.attr('data-bv-onerror'),
                    fields:         {},
                    feedbackIcons: {
                        valid:      this.$form.attr('data-bv-feedbackicons-valid'),
                        invalid:    this.$form.attr('data-bv-feedbackicons-invalid'),
                        validating: this.$form.attr('data-bv-feedbackicons-validating')
                    }
                };

            this.$form
                // Disable client side validation in HTML 5
                .attr('novalidate', 'novalidate')
                .addClass(this.options.elementClass)
                // Disable the default submission first
                .on('submit.bv', function(e) {
                    e.preventDefault();
                    that.validate();
                })
                .on('click.bv', this.options.submitButtons, function() {
                    that.$submitButton  = $(this);
                    // The user just click the submit button
                    that._submitIfValid = true;
                })
                // Find all fields which have either "name" or "data-bv-field" attribute
                .find('[name], [data-bv-field]')
                    .each(function() {
                        var $field = $(this),
                            field  = $field.attr('name') || $field.attr('data-bv-field'),
                            opts   = that._parseOptions($field);
                        if (opts) {
                            $field.attr('data-bv-field', field);
                            options.fields[field] = $.extend({}, opts, options.fields[field]);
                        }
                    });

            this.options = $.extend(true, this.options, options);
            for (var field in this.options.fields) {
                this._initField(field);
            }

            this.$form.trigger($.Event('init.form.bv'), {
                bv: this,
                options: this.options
            });

            // Prepare the events
            if (this.options.onSuccess) {
                this.$form.on('success.form.bv', function(e) {
                    $.fn.bootstrapValidator.helpers.call(that.options.onSuccess, [e]);
                });
            }
            if (this.options.onError) {
                this.$form.on('error.form.bv', function(e) {
                    $.fn.bootstrapValidator.helpers.call(that.options.onError, [e]);
                });
            }
        },

        /**
         * Parse the validator options from HTML attributes
         *
         * @param {jQuery} $field The field element
         * @returns {Object}
         */
        _parseOptions: function($field) {
            var field      = $field.attr('name') || $field.attr('data-bv-field'),
                validators = {},
                validator,
                v,          // Validator name
                enabled,
                optionName,
                optionValue,
                html5AttrName,
                html5AttrMap;

            for (v in $.fn.bootstrapValidator.validators) {
                validator    = $.fn.bootstrapValidator.validators[v];
                enabled      = $field.attr('data-bv-' + v.toLowerCase()) + '';
                html5AttrMap = ('function' === typeof validator.enableByHtml5) ? validator.enableByHtml5($field) : null;

                if ((html5AttrMap && enabled !== 'false')
                    || (html5AttrMap !== true && ('' === enabled || 'true' === enabled)))
                {
                    // Try to parse the options via attributes
                    validator.html5Attributes = $.extend({}, { message: 'message', onerror: 'onError', onsuccess: 'onSuccess' }, validator.html5Attributes);
                    validators[v] = $.extend({}, html5AttrMap === true ? {} : html5AttrMap, validators[v]);

                    for (html5AttrName in validator.html5Attributes) {
                        optionName  = validator.html5Attributes[html5AttrName];
                        optionValue = $field.attr('data-bv-' + v.toLowerCase() + '-' + html5AttrName);
                        if (optionValue) {
                            if ('true' === optionValue) {
                                optionValue = true;
                            } else if ('false' === optionValue) {
                                optionValue = false;
                            }
                            validators[v][optionName] = optionValue;
                        }
                    }
                }
            }

            var opts = {
                    excluded:      $field.attr('data-bv-excluded'),
                    feedbackIcons: $field.attr('data-bv-feedbackicons'),
                    trigger:       $field.attr('data-bv-trigger'),
                    message:       $field.attr('data-bv-message'),
                    container:     $field.attr('data-bv-container'),
                    group:         $field.attr('data-bv-group'),
                    selector:      $field.attr('data-bv-selector'),
                    threshold:     $field.attr('data-bv-threshold'),
                    onStatus:      $field.attr('data-bv-onstatus'),
                    onSuccess:     $field.attr('data-bv-onsuccess'),
                    onError:       $field.attr('data-bv-onerror'),
                    validators:    validators
                },
                emptyOptions    = $.isEmptyObject(opts),        // Check if the field options are set using HTML attributes
                emptyValidators = $.isEmptyObject(validators);  // Check if the field validators are set using HTML attributes

            if (!emptyValidators || (!emptyOptions && this.options.fields && this.options.fields[field])) {
                opts.validators = validators;
                return opts;
            } else {
                return null;
            }
        },

        /**
         * Init field
         *
         * @param {String|jQuery} field The field name or field element
         */
        _initField: function(field) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field');
                    break;
                case 'string':
                    fields = this.getFieldElements(field);
                    fields.attr('data-bv-field', field);
                    break;
                default:
                    break;
            }

            if (this.options.fields[field] === null || this.options.fields[field].validators === null) {
                return;
            }

            // We don't need to validate non-existing fields
            if (fields.length === 0) {
                delete this.options.fields[field];
                return;
            }
            var validatorName;
            for (validatorName in this.options.fields[field].validators) {
                if (!$.fn.bootstrapValidator.validators[validatorName]) {
                    delete this.options.fields[field].validators[validatorName];
                }
            }
            if (this.options.fields[field].enabled === null) {
                this.options.fields[field].enabled = true;
            }

            var that      = this,
                total     = fields.length,
                type      = fields.attr('type'),
                updateAll = (total === 1) || ('radio' === type) || ('checkbox' === type),
                event     = ('radio' === type || 'checkbox' === type || 'file' === type || 'SELECT' === fields.eq(0).get(0).tagName) ? 'change' : this._changeEvent,
                trigger   = (this.options.fields[field].trigger || this.options.trigger || event).split(' '),
                events    = $.map(trigger, function(item) {
                    return item + '.update.bv';
                }).join(' ');

            for (var i = 0; i < total; i++) {
                var $field    = fields.eq(i),
                    group     = this.options.fields[field].group || this.options.group,
                    $parent   = $field.parents(group),
                    // Allow user to indicate where the error messages are shown
                    container = this.options.fields[field].container || this.options.container,
                    $message  = (container && container !== 'tooltip' && container !== 'popover') ? $(container) : this._getMessageContainer($field, group);

                if (container && container !== 'tooltip' && container !== 'popover') {
                    $message.addClass('has-error');
                }

                // Remove all error messages and feedback icons
                $message.find('.help-block[data-bv-validator][data-bv-for="' + field + '"]').remove();
                $parent.find('i[data-bv-icon-for="' + field + '"]').remove();

                // Whenever the user change the field value, mark it as not validated yet
                $field.off(events).on(events, function() {
                    that.updateStatus($(this), that.STATUS_NOT_VALIDATED);
                });

                // Create help block elements for showing the error messages
                $field.data('bv.messages', $message);
                for (validatorName in this.options.fields[field].validators) {
                    $field.data('bv.result.' + validatorName, this.STATUS_NOT_VALIDATED);

                    if (!updateAll || i === total - 1) {
                        $('<small/>')
                            .css('display', 'none')
                            .addClass('help-block')
                            .attr('data-bv-validator', validatorName)
                            .attr('data-bv-for', field)
                            .attr('data-bv-result', this.STATUS_NOT_VALIDATED)
                            .html(this._getMessage(field, validatorName))
                            .appendTo($message);
                    }

                    // Prepare the validator events
                    if (this.options.fields[field].validators[validatorName].onSuccess) {
                        $field.on('success.validator.bv', function(e, data) {
                             $.fn.bootstrapValidator.helpers.call(that.options.fields[field].validators[validatorName].onSuccess, [e, data]);
                        });
                    }
                    if (this.options.fields[field].validators[validatorName].onError) {
                        $field.on('error.validator.bv', function(e, data) {
                             $.fn.bootstrapValidator.helpers.call(that.options.fields[field].validators[validatorName].onError, [e, data]);
                        });
                    }
                }

                // Prepare the feedback icons
                // Available from Bootstrap 3.1 (http://getbootstrap.com/css/#forms-control-validation)
                if (this.options.fields[field].feedbackIcons !== false && this.options.fields[field].feedbackIcons !== 'false'
                    && this.options.feedbackIcons
                    && this.options.feedbackIcons.validating && this.options.feedbackIcons.invalid && this.options.feedbackIcons.valid
                    && (!updateAll || i === total - 1))
                {
                    $parent.removeClass('has-success').removeClass('has-error').addClass('has-feedback');
                    var $icon = $('<i/>')
                                    .css('display', 'none')
                                    .addClass('form-control-feedback')
                                    .attr('data-bv-icon-for', field)
                                    // Place it after the label containing the checkbox/radio
                                    // so when clicking the icon, it doesn't effect to the checkbox/radio element
                                    .insertAfter(('checkbox' === type || 'radio' === type) ? $field.parent() : $field);

                    // The feedback icon does not render correctly if there is no label
                    // https://github.com/twbs/bootstrap/issues/12873
                    if ($parent.find('label').length === 0) {
                        $icon.css('top', 0);
                    }
                    // Fix feedback icons in input-group
                    if ($parent.find('.input-group').length !== 0) {
                        $icon.css({
                            'top': 0,
                            'z-index': 100
                        }).insertAfter($parent.find('.input-group').eq(0));
                    }
                }
            }

            // Prepare the events
            if (this.options.fields[field].onSuccess) {
                fields.on('success.field.bv', function(e, data) {
                    $.fn.bootstrapValidator.helpers.call(that.options.fields[field].onSuccess, [e, data]);
                });
            }
            if (this.options.fields[field].onError) {
                fields.on('error.field.bv', function(e, data) {
                    $.fn.bootstrapValidator.helpers.call(that.options.fields[field].onError, [e, data]);
                });
            }
            if (this.options.fields[field].onStatus) {
                fields.on('status.field.bv', function(e, data) {
                    $.fn.bootstrapValidator.helpers.call(that.options.fields[field].onStatus, [e, data]);
                });
            }

            // Set live mode
            events = $.map(trigger, function(item) {
                return item + '.live.bv';
            }).join(' ');
            switch (this.options.live) {
                case 'submitted':
                    break;
                case 'disabled':
                    fields.off(events);
                    break;
                case 'enabled':
                /* falls through */
                default:
                    fields.off(events).on(events, function() {
                        if (that._exceedThreshold($(this))) {
                            that.validateField($(this));
                        }
                    });
                    break;
            }

            fields.trigger($.Event('init.field.bv'), {
                bv: this,
                field: field,
                element: fields
            });
        },

        /**
         * Get the error message for given field and validator
         *
         * @param {String} field The field name
         * @param {String} validatorName The validator name
         * @returns {String}
         */
        _getMessage: function(field, validatorName) {
            if (!this.options.fields[field] || !$.fn.bootstrapValidator.validators[validatorName]
                || !this.options.fields[field].validators || !this.options.fields[field].validators[validatorName])
            {
                return '';
            }

            var options = this.options.fields[field].validators[validatorName];
            switch (true) {
                case (!!options.message):
                    return options.message;
                case (!!this.options.fields[field].message):
                    return this.options.fields[field].message;
                case (!!$.fn.bootstrapValidator.i18n[validatorName]):
                    return $.fn.bootstrapValidator.i18n[validatorName]['default'];
                default:
                    return this.options.message;
            }
        },

        /**
         * Get the element to place the error messages
         *
         * @param {jQuery} $field The field element
         * @param {String} group
         * @returns {jQuery}
         */
        _getMessageContainer: function($field, group) {
            var $parent = $field.parent();
            if ($parent.is(group)) {
                return $parent;
            }

            var cssClasses = $parent.attr('class');
            if (!cssClasses) {
                return this._getMessageContainer($parent, group);
            }

            cssClasses = cssClasses.split(' ');
            var n = cssClasses.length;
            for (var i = 0; i < n; i++) {
                if (/^col-(xs|sm|md|lg)-\d+$/.test(cssClasses[i]) || /^col-(xs|sm|md|lg)-offset-\d+$/.test(cssClasses[i])) {
                    return $parent;
                }
            }

            return this._getMessageContainer($parent, group);
        },

        /**
         * Called when all validations are completed
         */
        _submit: function() {
            var isValid   = this.isValid(),
                eventType = isValid ? 'success.form.bv' : 'error.form.bv',
                e         = $.Event(eventType);

            this.$form.trigger(e);

            // Call default handler
            // Check if whether the submit button is clicked
            if (this.$submitButton) {
                isValid ? this._onSuccess(e) : this._onError(e);
            }
        },

        /**
         * Check if the field is excluded.
         * Returning true means that the field will not be validated
         *
         * @param {jQuery} $field The field element
         * @returns {Boolean}
         */
        _isExcluded: function($field) {
            var excludedAttr = $field.attr('data-bv-excluded'),
                // I still need to check the 'name' attribute while initializing the field
                field        = $field.attr('data-bv-field') || $field.attr('name');

            switch (true) {
                case (!!field && this.options.fields && this.options.fields[field] && (this.options.fields[field].excluded === 'true' || this.options.fields[field].excluded === true)):
                case (excludedAttr === 'true'):
                case (excludedAttr === ''):
                    return true;

                case (!!field && this.options.fields && this.options.fields[field] && (this.options.fields[field].excluded === 'false' || this.options.fields[field].excluded === false)):
                case (excludedAttr === 'false'):
                    return false;

                default:
                    if (this.options.excluded) {
                        // Convert to array first
                        if ('string' === typeof this.options.excluded) {
                            this.options.excluded = $.map(this.options.excluded.split(','), function(item) {
                                // Trim the spaces
                                return $.trim(item);
                            });
                        }

                        var length = this.options.excluded.length;
                        for (var i = 0; i < length; i++) {
                            if (('string' === typeof this.options.excluded[i] && $field.is(this.options.excluded[i]))
                                || ('function' === typeof this.options.excluded[i] && this.options.excluded[i].call(this, $field, this) === true))
                            {
                                return true;
                            }
                        }
                    }
                    return false;
            }
        },

        /**
         * Check if the number of characters of field value exceed the threshold or not
         *
         * @param {jQuery} $field The field element
         * @returns {Boolean}
         */
        _exceedThreshold: function($field) {
            var field     = $field.attr('data-bv-field'),
                threshold = this.options.fields[field].threshold || this.options.threshold;
            if (!threshold) {
                return true;
            }
            var cannotType = $.inArray($field.attr('type'), ['button', 'checkbox', 'file', 'hidden', 'image', 'radio', 'reset', 'submit']) !== -1;
            return (cannotType || $field.val().length >= threshold);
        },
        
        // ---
        // Events
        // ---

        /**
         * The default handler of error.form.bv event.
         * It will be called when there is a invalid field
         *
         * @param {jQuery.Event} e The jQuery event object
         */
        _onError: function(e) {
            if (e.isDefaultPrevented()) {
                return;
            }

            if ('submitted' === this.options.live) {
                // Enable live mode
                this.options.live = 'enabled';
                var that = this;
                for (var field in this.options.fields) {
                    (function(f) {
                        var fields  = that.getFieldElements(f);
                        if (fields.length) {
                            var type    = $(fields[0]).attr('type'),
                                event   = ('radio' === type || 'checkbox' === type || 'file' === type || 'SELECT' === $(fields[0]).get(0).tagName) ? 'change' : that._changeEvent,
                                trigger = that.options.fields[field].trigger || that.options.trigger || event,
                                events  = $.map(trigger.split(' '), function(item) {
                                    return item + '.live.bv';
                                }).join(' ');

                            fields.off(events).on(events, function() {
                                if (that._exceedThreshold($(this))) {
                                    that.validateField($(this));
                                }
                            });
                        }
                    })(field);
                }
            }

            var $invalidField = this.$invalidFields.eq(0);
            if ($invalidField) {
                // Activate the tab containing the invalid field if exists
                var $tabPane = $invalidField.parents('.tab-pane'), tabId;
                if ($tabPane && (tabId = $tabPane.attr('id'))) {
                    $('a[href="#' + tabId + '"][data-toggle="tab"]').tab('show');
                }

                // Focus to the first invalid field
                $invalidField.focus();
            }
        },

        /**
         * The default handler of success.form.bv event.
         * It will be called when all the fields are valid
         *
         * @param {jQuery.Event} e The jQuery event object
         */
        _onSuccess: function(e) {
            if (e.isDefaultPrevented()) {
                return;
            }

            // Submit the form
            this.disableSubmitButtons(true).defaultSubmit();
        },

        /**
         * Called after validating a field element
         *
         * @param {jQuery} $field The field element
         * @param {String} [validatorName] The validator name
         */
        _onFieldValidated: function($field, validatorName) {
            var field         = $field.attr('data-bv-field'),
                validators    = this.options.fields[field].validators,
                counter       = {},
                numValidators = 0,
                data          = {
                    bv: this,
                    field: field,
                    element: $field,
                    validator: validatorName
                };

            // Trigger an event after given validator completes
            if (validatorName) {
                switch ($field.data('bv.result.' + validatorName)) {
                    case this.STATUS_INVALID:
                        $field.trigger($.Event('error.validator.bv'), data);
                        break;
                    case this.STATUS_VALID:
                        $field.trigger($.Event('success.validator.bv'), data);
                        break;
                    default:
                        break;
                }
            }

            counter[this.STATUS_NOT_VALIDATED] = 0;
            counter[this.STATUS_VALIDATING]    = 0;
            counter[this.STATUS_INVALID]       = 0;
            counter[this.STATUS_VALID]         = 0;

            for (var v in validators) {
                if (validators[v].enabled === false) {
                    continue;
                }

                numValidators++;
                var result = $field.data('bv.result.' + v);
                if (result) {
                    counter[result]++;
                }
            }

            if (counter[this.STATUS_VALID] === numValidators) {
                // Remove from the list of invalid fields
                this.$invalidFields = this.$invalidFields.not($field);

                $field.trigger($.Event('success.field.bv'), data);
            }
            // If all validators are completed and there is at least one validator which doesn't pass
            else if (counter[this.STATUS_NOT_VALIDATED] === 0 && counter[this.STATUS_VALIDATING] === 0 && counter[this.STATUS_INVALID] > 0) {
                // Add to the list of invalid fields
                this.$invalidFields = this.$invalidFields.add($field);

                $field.trigger($.Event('error.field.bv'), data);
            }
        },

        // ---
        // Public methods
        // ---

        /**
         * Retrieve the field elements by given name
         *
         * @param {String} field The field name
         * @returns {null|jQuery[]}
         */
        getFieldElements: function(field) {
            if (!this._cacheFields[field]) {
                this._cacheFields[field] = (this.options.fields[field] && this.options.fields[field].selector)
                                         ? $(this.options.fields[field].selector)
                                         : this.$form.find('[name="' + field + '"]');
            }

            return this._cacheFields[field];
        },

        /**
         * Disable/enable submit buttons
         *
         * @param {Boolean} disabled Can be true or false
         * @returns {BootstrapValidator}
         */
        disableSubmitButtons: function(disabled) {
            if (!disabled) {
                this.$form.find(this.options.submitButtons).removeAttr('disabled');
            } else if (this.options.live !== 'disabled') {
                // Don't disable if the live validating mode is disabled
                this.$form.find(this.options.submitButtons).attr('disabled', 'disabled');
            }

            return this;
        },

        /**
         * Validate the form
         *
         * @returns {BootstrapValidator}
         */
        validate: function() {
            if (!this.options.fields) {
                return this;
            }
            this.disableSubmitButtons(true);

            for (var field in this.options.fields) {
                this.validateField(field);
            }

            this._submit();

            return this;
        },

        /**
         * Validate given field
         *
         * @param {String|jQuery} field The field name or field element
         * @returns {BootstrapValidator}
         */
        validateField: function(field) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field');
                    break;
                case 'string':
                    fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            if (this.options.fields[field] && this.options.fields[field].enabled === false) {
                return this;
            }

            var that       = this,
                type       = fields.attr('type'),
                total      = ('radio' === type || 'checkbox' === type) ? 1 : fields.length,
                updateAll  = ('radio' === type || 'checkbox' === type),
                validators = this.options.fields[field].validators,
                validatorName,
                validateResult;

            for (var i = 0; i < total; i++) {
                var $field = fields.eq(i);
                if (this._isExcluded($field)) {
                    continue;
                }

                for (validatorName in validators) {
                    if ($field.data('bv.dfs.' + validatorName)) {
                        $field.data('bv.dfs.' + validatorName).reject();
                    }

                    // Don't validate field if it is already done
                    var result = $field.data('bv.result.' + validatorName);
                    if (result === this.STATUS_VALID || result === this.STATUS_INVALID || validators[validatorName].enabled === false) {
                        this._onFieldValidated($field, validatorName);
                        continue;
                    }

                    $field.data('bv.result.' + validatorName, this.STATUS_VALIDATING);
                    validateResult = $.fn.bootstrapValidator.validators[validatorName].validate(this, $field, validators[validatorName]);

                    // validateResult can be a $.Deferred object ...
                    if ('object' === typeof validateResult && validateResult.resolve) {
                        this.updateStatus(updateAll ? field : $field, this.STATUS_VALIDATING, validatorName);
                        $field.data('bv.dfs.' + validatorName, validateResult);

                        validateResult.done(function($f, v, isValid, message) {
                            // v is validator name
                            $f.removeData('bv.dfs.' + v);
                            if (message) {
                                that.updateMessage($f, v, message);
                            }

                            that.updateStatus(updateAll ? $f.attr('data-bv-field') : $f, isValid ? that.STATUS_VALID : that.STATUS_INVALID, v);

                            if (isValid && that._submitIfValid === true) {
                                // If a remote validator returns true and the form is ready to submit, then do it
                                that._submit();
                            }
                        });
                    }
                    // ... or object { valid: true/false, message: 'dynamic message' }
                    else if ('object' === typeof validateResult && validateResult.valid !== undefined && validateResult.message !== undefined) {
                        this.updateMessage(updateAll ? field : $field, validatorName, validateResult.message);
                        this.updateStatus(updateAll ? field : $field, validateResult.valid ? this.STATUS_VALID : this.STATUS_INVALID, validatorName);
                    }
                    // ... or a boolean value
                    else if ('boolean' === typeof validateResult) {
                        this.updateStatus(updateAll ? field : $field, validateResult ? this.STATUS_VALID : this.STATUS_INVALID, validatorName);
                    }
                }
            }

            return this;
        },

        /**
         * Update the error message
         *
         * @param {String|jQuery} field The field name or field element
         * @param {String} validator The validator name
         * @param {String} message The message
         * @returns {BootstrapValidator}
         */
        updateMessage: function(field, validator, message) {
            var $fields = $([]);
            switch (typeof field) {
                case 'object':
                    $fields = field;
                    field   = field.attr('data-bv-field');
                    break;
                case 'string':
                    $fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            $fields.each(function() {
                $(this).data('bv.messages').find('.help-block[data-bv-validator="' + validator + '"][data-bv-for="' + field + '"]').html(message);
            });
        },
        
        /**
         * Update all validating results of field
         *
         * @param {String|jQuery} field The field name or field element
         * @param {String} status The status. Can be 'NOT_VALIDATED', 'VALIDATING', 'INVALID' or 'VALID'
         * @param {String} [validatorName] The validator name. If null, the method updates validity result for all validators
         * @returns {BootstrapValidator}
         */
        updateStatus: function(field, status, validatorName) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field');
                    break;
                case 'string':
                    fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            if (status === this.STATUS_NOT_VALIDATED) {
                // Reset the flag
                this._submitIfValid = false;
            }

            var that  = this,
                type  = fields.attr('type'),
                group = this.options.fields[field].group || this.options.group,
                total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

            for (var i = 0; i < total; i++) {
                var $field       = fields.eq(i);
                if (this._isExcluded($field)) {
                    continue;
                }

                var $parent      = $field.parents(group),
                    $message     = $field.data('bv.messages'),
                    $allErrors   = $message.find('.help-block[data-bv-validator][data-bv-for="' + field + '"]'),
                    $errors      = validatorName ? $allErrors.filter('[data-bv-validator="' + validatorName + '"]') : $allErrors,
                    $icon        = $parent.find('.form-control-feedback[data-bv-icon-for="' + field + '"]'),
                    container    = this.options.fields[field].container || this.options.container,
                    isValidField = null;

                // Update status
                if (validatorName) {
                    $field.data('bv.result.' + validatorName, status);
                } else {
                    for (var v in this.options.fields[field].validators) {
                        $field.data('bv.result.' + v, status);
                    }
                }

                // Show/hide error elements and feedback icons
                $errors.attr('data-bv-result', status);

                // Determine the tab containing the element
                var $tabPane = $field.parents('.tab-pane'),
                    tabId, $tab;
                if ($tabPane && (tabId = $tabPane.attr('id'))) {
                    $tab = $('a[href="#' + tabId + '"][data-toggle="tab"]').parent();
                }

                switch (status) {
                    case this.STATUS_VALIDATING:
                        isValidField = null;
                        this.disableSubmitButtons(true);
                        $parent.removeClass('has-success').removeClass('has-error');
                        if ($icon) {
                            $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).addClass(this.options.feedbackIcons.validating).show();
                        }
                        if ($tab) {
                            $tab.removeClass('bv-tab-success').removeClass('bv-tab-error');
                        }
                        break;

                    case this.STATUS_INVALID:
                        isValidField = false;
                        this.disableSubmitButtons(true);
                        $parent.removeClass('has-success').addClass('has-error');
                        if ($icon) {
                            $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.invalid).show();
                        }
                        if ($tab) {
                            $tab.removeClass('bv-tab-success').addClass('bv-tab-error');
                        }
                        break;

                    case this.STATUS_VALID:
                        // If the field is valid (passes all validators)
                        isValidField = ($allErrors.filter('[data-bv-result="' + this.STATUS_NOT_VALIDATED +'"]').length === 0)
                                     ? ($allErrors.filter('[data-bv-result="' + this.STATUS_VALID +'"]').length === $allErrors.length)  // All validators are completed
                                     : null;                                                                                            // There are some validators that have not done
                        if (isValidField !== null) {
                            this.disableSubmitButtons(this.$submitButton ? !this.isValid() : !isValidField);
                            if ($icon) {
                                $icon
                                    .removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).removeClass(this.options.feedbackIcons.valid)
                                    .addClass(isValidField ? this.options.feedbackIcons.valid : this.options.feedbackIcons.invalid)
                                    .show();
                            }
                        }

                        $parent.removeClass('has-error has-success').addClass(this.isValidContainer($parent) ? 'has-success' : 'has-error');
                        if ($tab) {
                            $tab.removeClass('bv-tab-success').removeClass('bv-tab-error').addClass(this.isValidContainer($tabPane) ? 'bv-tab-success' : 'bv-tab-error');
                        }
                        break;

                    case this.STATUS_NOT_VALIDATED:
                    /* falls through */
                    default:
                        isValidField = null;
                        this.disableSubmitButtons(false);
                        $parent.removeClass('has-success').removeClass('has-error');
                        if ($icon) {
                            $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).hide();
                        }
                        if ($tab) {
                            $tab.removeClass('bv-tab-success').removeClass('bv-tab-error');
                        }
                        break;
                }

                switch (true) {
                    // Only show the first error message if it is placed inside a tooltip ...
                    case ($icon && 'tooltip' === container):
                        (isValidField === false)
                                ? $icon.css('cursor', 'pointer').tooltip('destroy').tooltip({
                                    html: true,
                                    placement: 'top',
                                    title: $allErrors.filter('[data-bv-result="' + that.STATUS_INVALID + '"]').eq(0).html()
                                })
                                : $icon.css('cursor', '').tooltip('destroy');
                        break;
                    // ... or popover
                    case ($icon && 'popover' === container):
                        (isValidField === false)
                                ? $icon.css('cursor', 'pointer').popover('destroy').popover({
                                    content: $allErrors.filter('[data-bv-result="' + that.STATUS_INVALID + '"]').eq(0).html(),
                                    html: true,
                                    placement: 'top',
                                    trigger: 'hover click'
                                })
                                : $icon.css('cursor', '').popover('destroy');
                        break;
                    default:
                        (status === this.STATUS_INVALID) ? $errors.show() : $errors.hide();
                        break;
                }

                // Trigger an event
                $field.trigger($.Event('status.field.bv'), {
                    bv: this,
                    field: field,
                    element: $field,
                    status: status
                });
                this._onFieldValidated($field, validatorName);
            }

            return this;
        },

        /**
         * Check the form validity
         *
         * @returns {Boolean}
         */
        isValid: function() {
            for (var field in this.options.fields) {
                if (!this.isValidField(field)) {
                    return false;
                }
            }

            return true;
        },

        /**
         * Check if the field is valid or not
         *
         * @param {String|jQuery} field The field name or field element
         * @returns {Boolean}
         */
        isValidField: function(field) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field');
                    break;
                case 'string':
                    fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }
            if (fields.length === 0 || this.options.fields[field] === null || this.options.fields[field].enabled === false) {
                return true;
            }

            var type  = fields.attr('type'),
                total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length,
                $field, validatorName, status;
            for (var i = 0; i < total; i++) {
                $field = fields.eq(i);
                if (this._isExcluded($field)) {
                    continue;
                }

                for (validatorName in this.options.fields[field].validators) {
                    if (this.options.fields[field].validators[validatorName].enabled === false) {
                        continue;
                    }

                    status = $field.data('bv.result.' + validatorName);
                    if (status !== this.STATUS_VALID) {
                        return false;
                    }
                }
            }

            return true;
        },

        /**
         * Check if all fields inside a given container are valid.
         * It's useful when working with a wizard-like such as tab, collapse
         *
         * @param {String|jQuery} container The container selector or element
         * @returns {Boolean}
         */
        isValidContainer: function(container) {
            var that       = this,
                map        = {},
                $container = ('string' === typeof container) ? $(container) : container;
            if ($container.length === 0) {
                return true;
            }

            $container.find('[data-bv-field]').each(function() {
                var $field = $(this),
                    field  = $field.attr('data-bv-field');
                if (!that._isExcluded($field) && !map[field]) {
                    map[field] = $field;
                }
            });

            for (var field in map) {
                var $f = map[field];
                if ($f.data('bv.messages')
                      .find('.help-block[data-bv-validator][data-bv-for="' + field + '"]')
                      .filter(function() {
                          var v = $(this).attr('data-bv-validator'),
                              f = $(this).attr('data-bv-for');
                          return (that.options.fields[f].validators[v].enabled !== false
                                && $f.data('bv.result.' + v) && $f.data('bv.result.' + v) !== that.STATUS_VALID);
                      })
                      .length !== 0)
                {
                    // The field is not valid
                    return false;
                }
            }

            return true;
        },

        /**
         * Submit the form using default submission.
         * It also does not perform any validations when submitting the form
         */
        defaultSubmit: function() {
            if (this.$submitButton) {
                // Create hidden input to send the submit buttons
                $('<input/>')
                    .attr('type', 'hidden')
                    .attr('data-bv-submit-hidden', '')
                    .attr('name', this.$submitButton.attr('name'))
                    .val(this.$submitButton.val())
                    .appendTo(this.$form);
            }

            // Submit form
            this.$form.off('submit.bv').submit();
        },

        // ---
        // Useful APIs which aren't used internally
        // ---

        /**
         * Get the list of invalid fields
         *
         * @returns {jQuery[]}
         */
        getInvalidFields: function() {
            return this.$invalidFields;
        },

        /**
         * Returns the clicked submit button
         *
         * @returns {jQuery}
         */
        getSubmitButton: function() {
            return this.$submitButton;
        },

        /**
         * Get the error messages
         *
         * @param {String|jQuery} [field] The field name or field element
         * If the field is not defined, the method returns all error messages of all fields
         * @param {String} [validator] The name of validator
         * If the validator is not defined, the method returns error messages of all validators
         * @returns {String[]}
         */
        getMessages: function(field, validator) {
            var that     = this,
                messages = [],
                $fields  = $([]);

            switch (true) {
                case (field && 'object' === typeof field):
                    $fields = field;
                    break;
                case (field && 'string' === typeof field):
                    var f = this.getFieldElements(field);
                    if (f.length > 0) {
                        var type = f.attr('type');
                        $fields = ('radio' === type || 'checkbox' === type) ? f.eq(0) : f;
                    }
                    break;
                default:
                    $fields = this.$invalidFields;
                    break;
            }

            var filter = validator ? '[data-bv-validator="' + validator + '"]' : '';
            $fields.each(function() {
                messages = messages.concat(
                    $(this)
                        .data('bv.messages')
                        .find('.help-block[data-bv-for="' + $(this).attr('data-bv-field') + '"][data-bv-result="' + that.STATUS_INVALID + '"]' + filter)
                        .map(function() {
                            var v = $(this).attr('data-bv-validator'),
                                f = $(this).attr('data-bv-for');
                            return (that.options.fields[f].validators[v].enabled === false) ? '' : $(this).html();
                        })
                        .get()
                );
            });

            return messages;
        },

        /**
         * Get the field options
         *
         * @param {String|jQuery} [field] The field name or field element. If it is not set, the method returns the form options
         * @param {String} [validator] The name of validator. It null, the method returns form options
         * @param {String} [option] The option name
         * @return {String|Object}
         */
        getOptions: function(field, validator, option) {
            if (!field) {
                return this.options;
            }
            if ('object' === typeof field) {
                field = field.attr('data-bv-field');
            }
            if (!this.options.fields[field]) {
                return null;
            }

            var options = this.options.fields[field];
            if (!validator) {
                return options;
            }
            if (!options.validators || !options.validators[validator]) {
                return null;
            }

            return option ? options.validators[validator][option] : options.validators[validator];
        },

        /**
         * Update the option of a specific validator
         *
         * @param {String|jQuery} field The field name or field element
         * @param {String} validator The validator name
         * @param {String} option The option name
         * @param {String} value The value to set
         * @returns {BootstrapValidator}
         */
        updateOption: function(field, validator, option, value) {
            if ('object' === typeof field) {
                field = field.attr('data-bv-field');
            }
            if (this.options.fields[field] && this.options.fields[field].validators[validator]) {
                this.options.fields[field].validators[validator][option] = value;
                this.updateStatus(field, this.STATUS_NOT_VALIDATED, validator);
            }

            return this;
        },

        /**
         * Add a new field
         *
         * @param {String|jQuery} field The field name or field element
         * @param {Object} [options] The validator rules
         * @returns {BootstrapValidator}
         */
        addField: function(field, options) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field') || field.attr('name');
                    break;
                case 'string':
                    delete this._cacheFields[field];
                    fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            fields.attr('data-bv-field', field);

            var type  = fields.attr('type'),
                total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

            for (var i = 0; i < total; i++) {
                var $field = fields.eq(i);

                // Try to parse the options from HTML attributes
                var opts = this._parseOptions($field);
                opts = (opts === null) ? options : $.extend(true, options, opts);

                this.options.fields[field] = $.extend(true, this.options.fields[field], opts);

                // Update the cache
                this._cacheFields[field] = this._cacheFields[field] ? this._cacheFields[field].add($field) : $field;

                // Init the element
                this._initField(('checkbox' === type || 'radio' === type) ? field : $field);
            }

            this.disableSubmitButtons(false);
            // Trigger an event
            this.$form.trigger($.Event('added.field.bv'), {
                field: field,
                element: fields,
                options: this.options.fields[field]
            });

            return this;
        },

        /**
         * Remove a given field
         *
         * @param {String|jQuery} field The field name or field element
         * @returns {BootstrapValidator}
         */
        removeField: function(field) {
            var fields = $([]);
            switch (typeof field) {
                case 'object':
                    fields = field;
                    field  = field.attr('data-bv-field') || field.attr('name');
                    fields.attr('data-bv-field', field);
                    break;
                case 'string':
                    fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            if (fields.length === 0) {
                return this;
            }

            var type  = fields.attr('type'),
                total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

            for (var i = 0; i < total; i++) {
                var $field = fields.eq(i);

                // Remove from the list of invalid fields
                this.$invalidFields = this.$invalidFields.not($field);

                // Update the cache
                this._cacheFields[field] = this._cacheFields[field].not($field);
            }

            if (!this._cacheFields[field] || this._cacheFields[field].length === 0) {
                delete this.options.fields[field];
            }
            if ('checkbox' === type || 'radio' === type) {
                this._initField(field);
            }

            this.disableSubmitButtons(false);
            // Trigger an event
            this.$form.trigger($.Event('removed.field.bv'), {
                field: field,
                element: fields
            });

            return this;
        },

        /**
         * Reset given field
         *
         * @param {String|jQuery} field The field name or field element
         * @param {Boolean} [resetValue] If true, the method resets field value to empty or remove checked/selected attribute (for radio/checkbox)
         * @returns {BootstrapValidator}
         */
        resetField: function(field, resetValue) {
            var $fields = $([]);
            switch (typeof field) {
                case 'object':
                    $fields = field;
                    field   = field.attr('data-bv-field');
                    break;
                case 'string':
                    $fields = this.getFieldElements(field);
                    break;
                default:
                    break;
            }

            var total = $fields.length;
            if (this.options.fields[field]) {
                for (var i = 0; i < total; i++) {
                    for (var validator in this.options.fields[field].validators) {
                        $fields.eq(i).removeData('bv.dfs.' + validator);
                    }
                }
            }

            // Mark field as not validated yet
            this.updateStatus(field, this.STATUS_NOT_VALIDATED);

            if (resetValue) {
                var type = $fields.attr('type');
                ('radio' === type || 'checkbox' === type) ? $fields.removeAttr('checked').removeAttr('selected') : $fields.val('');
            }

            return this;
        },

        resetForm: function(resetValue) {
            for (var field in this.options.fields) {
                this.resetField(field, resetValue);
            }

            this.$invalidFields = $([]);
            this.$submitButton  = null;

            // Enable submit buttons
            this.disableSubmitButtons(false);

            return this;
        },

        revalidateField: function(field) {
            this.updateStatus(field, this.STATUS_NOT_VALIDATED)
                .validateField(field);

            return this;
        },

        enableFieldValidators: function(field, enabled, validatorName) {
            var validators = this.options.fields[field].validators;

            // Enable/disable particular validator
            if (validatorName
                && validators
                && validators[validatorName] && validators[validatorName].enabled !== enabled)
            {
                this.options.fields[field].validators[validatorName].enabled = enabled;
                this.updateStatus(field, this.STATUS_NOT_VALIDATED, validatorName);
            }
            // Enable/disable all validators
            else if (!validatorName && this.options.fields[field].enabled !== enabled) {
                this.options.fields[field].enabled = enabled;
                for (var v in validators) {
                    this.enableFieldValidators(field, enabled, v);
                }
            }

            return this;
        },

        getDynamicOption: function(field, option) {
            var $field = ('string' === typeof field) ? this.getFieldElements(field) : field,
                value  = $field.val();

            // Option can be determined by
            // ... a function
            if ('function' === typeof option) {
                return $.fn.bootstrapValidator.helpers.call(option, [value, this, $field]);
            }
            // ... value of other field
            else if ('string' === typeof option) {
                var $f = this.getFieldElements(option);
                if ($f.length) {
                    return $f.val();
                }
                // ... return value of callback
                else {
                    return $.fn.bootstrapValidator.helpers.call(option, [value, this, $field]);
                }
            }

            return null;
        },

        /**
         * Destroy the plugin
         * It will remove all error messages, feedback icons and turn off the events
         */
        destroy: function() {
            var field, fields, $field, validator, $icon, container, group;
            for (field in this.options.fields) {
                fields    = this.getFieldElements(field);
                container = this.options.fields[field].container || this.options.container,
                group     = this.options.fields[field].group || this.options.group;
                for (var i = 0; i < fields.length; i++) {
                    $field = fields.eq(i);
                    $field
                        // Remove all error messages
                        .data('bv.messages')
                            .find('.help-block[data-bv-validator][data-bv-for="' + field + '"]').remove().end()
                            .end()
                        .removeData('bv.messages')
                        // Remove feedback classes
                        .parents(group)
                            .removeClass('has-feedback has-error has-success')
                            .end()
                        // Turn off events
                        .off('.bv')
                        .removeAttr('data-bv-field');

                    // Remove feedback icons, tooltip/popover container
                    $icon = $field.parents(group).find('i[data-bv-icon-for="' + field + '"]');
                    if ($icon) {
                        switch (container) {
                            case 'tooltip':
                                $icon.tooltip('destroy').remove();
                                break;
                            case 'popover':
                                $icon.popover('destroy').remove();
                                break;
                            default:
                                $icon.remove();
                                break;
                        }
                    }

                    for (validator in this.options.fields[field].validators) {
                        if ($field.data('bv.dfs.' + validator)) {
                            $field.data('bv.dfs.' + validator).reject();
                        }
                        $field.removeData('bv.result.' + validator).removeData('bv.dfs.' + validator);
                    }
                }
            }

            // Enable submit buttons
            this.disableSubmitButtons(false);

            this.$form
                .removeClass(this.options.elementClass)
                .off('.bv')
                .removeData('bootstrapValidator')
                // Remove generated hidden elements
                .find('[data-bv-submit-hidden]').remove();
        }
    };

    // Plugin definition
    $.fn.bootstrapValidator = function(option) {
        var params = arguments;
        return this.each(function() {
            var $this   = $(this),
                data    = $this.data('bootstrapValidator'),
                options = 'object' === typeof option && option;
            if (!data) {
                data = new BootstrapValidator(this, options);
                $this.data('bootstrapValidator', data);
            }

            // Allow to call plugin method
            if ('string' === typeof option) {
                data[option].apply(data, Array.prototype.slice.call(params, 1));
            }
        });
    };

    // The default options
    $.fn.bootstrapValidator.DEFAULT_OPTIONS = {
        // The form CSS class
        elementClass: 'bv-form',

        // Default invalid message
        message: '请输入有效的值',
        group: '.form-group',
        container: null,
        threshold: null,
        excluded: [':disabled', ':hidden', ':not(:visible)'],
        feedbackIcons: {
            valid:      null,
            invalid:    null,
            validating: null
        },
        submitButtons: '[type="submit"]',
        live: 'enabled',
        fields: null
    };

    $.fn.bootstrapValidator.validators  = {};
    $.fn.bootstrapValidator.i18n        = {};
    $.fn.bootstrapValidator.Constructor = BootstrapValidator;

    // Helper methods, which can be used in validator class
    $.fn.bootstrapValidator.helpers = {
        call: function(functionName, args) {
            if ('function' === typeof functionName) {
                return functionName.apply(this, args);
            } else if ('string' === typeof functionName) {
                if ('()' === functionName.substring(functionName.length - 2)) {
                    functionName = functionName.substring(0, functionName.length - 2);
                }
                var ns      = functionName.split('.'),
                    func    = ns.pop(),
                    context = window;
                for (var i = 0; i < ns.length; i++) {
                    context = context[ns[i]];
                }
                return context[func].apply(this, args);
            }
        },
        format: function(message, parameters) {
            if (!$.isArray(parameters)) {
                parameters = [parameters];
            }

            for (var i in parameters) {
                message = message.replace('%s', parameters[i]);
            }

            return message;
        },
        date: function(year, month, day, notInFuture) {
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                return false;
            }

            day   = parseInt(day, 10);
            month = parseInt(month, 10);
            year  = parseInt(year, 10);

            if (year < 1000 || year > 9999 || month <= 0 || month > 12) {
                return false;
            }
            var numDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            // Update the number of days in Feb of leap year
            if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
                numDays[1] = 29;
            }

            // Check the day
            if (day <= 0 || day > numDays[month - 1]) {
                return false;
            }

            if (notInFuture === true) {
                var currentDate  = new Date(),
                    currentYear  = currentDate.getFullYear(),
                    currentMonth = currentDate.getMonth(),
                    currentDay   = currentDate.getDate();
                return (year < currentYear
                        || (year === currentYear && month - 1 < currentMonth)
                        || (year === currentYear && month - 1 === currentMonth && day < currentDay));
            }

            return true;
        }
    };
}(window.jQuery));
/*callback*/
;(function($) {
    $.fn.bootstrapValidator.validators.callback = {
        html5Attributes: {
            message: 'message',
            callback: 'callback'
        },

        /**
         * Return result from the callback method
         *
         * @param {BootstrapValidator} validator The validator plugin instance
         * @param {jQuery} $field Field element
         * @param {Object} options Can consist of the following keys:
         * - callback: The callback method that passes 2 parameters:
         *      callback: function(fieldValue, validator, $field) {
         *          // fieldValue is the value of field
         *          // validator is instance of BootstrapValidator
         *          // $field is the field element
         *      }
         * - message: The invalid message
         * @returns {Boolean|Deferred}
         */
        validate: function(validator, $field, options) {
            var value = $field.val();

            if (options.callback) {
                var dfd      = new $.Deferred(),
                    response = $.fn.bootstrapValidator.helpers.call(options.callback, [value, validator, $field]);
                dfd.resolve($field, 'callback', 'boolean' === typeof response ? response : response.valid, 'object' === typeof response && response.message ? response.message : null);
                return dfd;
            }

            return true;
        }
    };
}(window.jQuery));
/*digits*/
;(function($) {
    $.fn.bootstrapValidator.validators.digits = {
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

            return /^\d+$/.test(value);
        }
    };
}(window.jQuery));
/*stringLength*/
;(function($) {
    $.fn.bootstrapValidator.i18n.stringLength = $.extend($.fn.bootstrapValidator.i18n.stringLength || {}, {
        'default': 'Please enter a value with valid length',
        less: 'Please enter less than %s characters',
        more: 'Please enter more than %s characters',
        between: 'Please enter value between %s and %s characters long'
    });

    $.fn.bootstrapValidator.validators.stringLength = {
        html5Attributes: {
            message: 'message',
            min: 'min',
            max: 'max'
        },

        enableByHtml5: function($field) {
            var maxLength = $field.attr('maxlength');
            if (maxLength) {
                return {
                    max: parseInt(maxLength, 10)
                };
            }

            return false;
        },
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

            var min     = $.isNumeric(options.min) ? options.min : validator.getDynamicOption($field, options.min),
                max     = $.isNumeric(options.max) ? options.max : validator.getDynamicOption($field, options.max),
                length  = value.length,
                isValid = true,
                message = options.message || $.fn.bootstrapValidator.i18n.stringLength['default'];

            if ((min && length < parseInt(min, 10)) || (max && length > parseInt(max, 10))) {
                isValid = false;
            }

            switch (true) {
                case (!!min && !!max):
                    message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.stringLength.between, [parseInt(min, 10), parseInt(max, 10)]);
                    break;

                case (!!min):
                    message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.stringLength.more, parseInt(min, 10));
                    break;

                case (!!max):
                    message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.stringLength.less, parseInt(max, 10));
                    break;

                default:
                    break;
            }

            return { valid: isValid, message: message };
        }
    };
}(window.jQuery));
/*email*/
;(function($) {
    $.fn.bootstrapValidator.validators.emailAddress = {
        enableByHtml5: function($field) {
            return ('email' === $field.attr('type'));
        },
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }
            var emailRegExp = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            return emailRegExp.test(value);
        }
    };
}(window.jQuery));
/*identical*/
;(function($) {
    $.fn.bootstrapValidator.validators.identical = {
        html5Attributes: {
            message: 'message',
            field: 'field'
        },
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

            var compareWith = validator.getFieldElements(options.field);
            if (compareWith === null) {
                return true;
            }

            if (value === compareWith.val()) {
                validator.updateStatus(options.field, validator.STATUS_VALID, 'identical');
                return true;
            } else {
                return false;
            }
        }
    };
}(window.jQuery));
/*empty*/
;(function($) {
    $.fn.bootstrapValidator.validators.notEmpty = {
        enableByHtml5: function($field) {
            var required = $field.attr('required') + '';
            return ('required' === required || 'true' === required);
        },
        validate: function(validator, $field, options) {
            var type = $field.attr('type');
            if ('radio' === type || 'checkbox' === type) {
                return validator
                            .getFieldElements($field.attr('data-bv-field'))
                            .filter(':checked')
                            .length > 0;
            }

            return $.trim($field.val()) !== '';
        }
    };
}(window.jQuery));
/*phone*/
;(function($) {
    $.fn.bootstrapValidator.validators.phone = {
       
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }
            var phoneRegExp = /^(13[0-9]|14[0-9]|15[0-9]|18[0-9])\d{8}$/i;
            return phoneRegExp.test(value);
        }
    };
}(window.jQuery));
/*uri*/
;(function($) {
    $.fn.bootstrapValidator.validators.uri = {
        html5Attributes: {
            message: 'message',
            allowlocal: 'allowLocal'
        },

        enableByHtml5: function($field) {
            return ('url' === $field.attr('type'));
        },

        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

           
            var allowLocal = options.allowLocal === true || options.allowLocal === 'true',
                urlExp     = new RegExp(
                    "^" +
                    // protocol identifier
                    "(?:(?:https?|ftp)://)" +
                    // user:pass authentication
                    "(?:\\S+(?::\\S*)?@)?" +
                    "(?:" +
                    // IP address exclusion
                    // private & local networks
                    (allowLocal
                        ? ''
                        : ("(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
                           "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
                           "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})")) +
                    // IP address dotted notation octets
                    // excludes loopback network 0.0.0.0
                    // excludes reserved space >= 224.0.0.0
                    // excludes network & broadcast addresses
                    // (first & last IP address of each class)
                    "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
                    "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
                    "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
                    "|" +
                    // host name
                    "(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)" +
                    // domain name
                    "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*" +
                    // TLD identifier
                    "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
                    // Allow intranet sites (no TLD) if `allowLocal` is true
                    (allowLocal ? '?' : '') +
                    ")" +
                    // port number
                    "(?::\\d{2,5})?" +
                    // resource path
                    "(?:/[^\\s]*)?" +
                    "$", "i"
                );

            return urlExp.test(value);
        }
    };
}(window.jQuery));
/*remote*/
;(function($) {
    $.fn.bootstrapValidator.validators.remote = {
        html5Attributes: {
            message: 'message',
            url: 'url',
            name: 'name'
        },

        /**
         * Request a remote server to check the input value
         *
         * @param {BootstrapValidator} validator Plugin instance
         * @param {jQuery} $field Field element
         * @param {Object} options Can consist of the following keys:
         * - url {String|Function}
         * - type {String} [optional] Can be GET or POST (default)
         * - data {Object|Function} [optional]: By default, it will take the value
         *  {
         *      <fieldName>: <fieldValue>
         *  }
         * - name {String} [optional]: Override the field name for the request.
         * - message: The invalid message
         * @returns {Boolean|Deferred}
         */
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

            var name = $field.attr('data-bv-field'),
                data = options.data || {},
                url  = options.url,
                type = options.type || 'POST';

            // Support dynamic data
            if ('function' === typeof data) {
                data = data.call(this, validator);
            }

            // Support dynamic url
            if ('function' === typeof url) {
                url = url.call(this, validator);
            }

            data[options.name || name] = value;

            var dfd = new $.Deferred();
            var xhr = $.ajax({
                type: type,
                url: url,
                dataType: 'json',
                data: data
            });
            xhr.then(function(response) {
                dfd.resolve($field, 'remote', response.valid === true || response.valid === 'true', response.message ? response.message : null);
            });

            dfd.fail(function() {
                xhr.abort();
            });

            return dfd;
        }
    };
}(window.jQuery));
/*regexp*/
;(function($) {
    $.fn.bootstrapValidator.validators.regexp = {
        html5Attributes: {
            message: 'message',
            regexp: 'regexp'
        },

        enableByHtml5: function($field) {
            var pattern = $field.attr('pattern');
            if (pattern) {
                return {
                    regexp: pattern
                };
            }

            return false;
        },

        /**
         * Check if the element value matches given regular expression
         *
         * @param {BootstrapValidator} validator The validator plugin instance
         * @param {jQuery} $field Field element
         * @param {Object} options Consists of the following key:
         * - regexp: The regular expression you need to check
         * @returns {Boolean}
         */
        validate: function(validator, $field, options) {
            var value = $field.val();
            if (value === '') {
                return true;
            }

            var regexp = ('string' === typeof options.regexp) ? new RegExp(options.regexp) : options.regexp;
            return regexp.test(value);
        }
    };
}(window.jQuery));
/*messages*/
;(function ($) {
    $.fn.bootstrapValidator.i18n = $.extend(true, $.fn.bootstrapValidator.i18n, {
        date: {
            'default': '请输入有效的日期'
        },
        different: {
            'default': '请输入不一样的值'
        },
        digits: {
            'default': '只能输入数字'
        },
        emailAddress: {
            'default': '请输入有效的EMAIL'
        },
        file: {
            'default': '请选择有效的档案'
        },
        greaterThan: {
            'default': '请输入大于或等于 %s 的值',
            notInclusive: '请输入大于 %s 的值'
        },
        identical: {
            'default': '请输入一样的值'
        },
        notEmpty: {
            'default': '该项不能为空'
        },
        uri: {
            'default': '请输入一个有效的链接'
        },
        phone: {
            'default': '请输入有效的电话号码'
        },
        regexp: {
            'default': '输入格式不正确'
        },
        remote: {
            'default': '请输入有效的值'
        },
        stringLength: {
            'default': '请输入符合长度限制的值',
            less: '请输入小于 %s 个字',
            more: '请输入大于 %s 个字',
            between: '请输入介于 %s 至 %s 个字'
        }
    });
}(window.jQuery));