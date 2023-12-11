const DEFAULT_OPTIONS = {
  i18nDefaultScope: true,
  addI18nScope: true,
  injectI18nScope: true,
  suffix: '_i18n',
};

/**
 * @param {Model} model
 * @return {Object|null}
 */
function $getModelUniqueKey(model) {
  const objList = Object.values(model);
  let [pk] = objList.filter((obj) => obj.primaryKey);

  if (!pk) {
    [pk] = objList.filter((obj) => obj.unique);
  }

  return pk || null;
}

/**
 * @param {Model} model
 * @param {Object} schema
 * @param {Object} options
 */
function $createI18nModel(modelName, props, options) {
  const i18nModelName = `${modelName}${this.options.suffix}`;

  this.sequelize.define(i18nModelName, props, options);
  this.i18nModels[modelName] = {
    name: i18nModelName,
    model: props,
  };
}

/**
 * @param {Object} options
 */
function $addLanguage(options) {
  if (this.rawAttributes.language_id && this.rawAttributes.language_id.type.constructor.name === 'VIRTUAL' && (options.language_id || (options.where && options.where.language_id))) {
    if (!options.attributes) {
      options.attributes = Object.keys(this.tableAttributes);
    }

    const locale = options.language_id || options.where.language_id;
    options.attributes.push([
      this.sequelize.literal(`'${locale}'`),
      'language_id',
    ]);
  }
}

/**
 * @param {Object} i18nModel
 * @param {Object} options
 * @param {String} prop
 * @return {Function}
 */
function $updateWhereClause(i18nModel, options, prop) {
  return (incl) => {
    if (incl.model.name === i18nModel.name) {
      return Object.assign(incl, {
        where: {
          ...incl.where,
          [prop]: options.where[prop],
        },
      });
    }

    return incl;
  };
}

/**
 * @param {Object} options
 */
function $beforeFind(options) {
  if (options && this.i18nModel) {
    if (options.where) {
      Object.keys(options.where).forEach((prop) => {
        options.include = options.include || [];

        if (this.i18nModel.model[prop] || Array.isArray(options.where[prop])) {
          options.include.forEach($updateWhereClause(this.i18nModel, options, prop));

          delete options.where[prop];
        }
      });
    }

    if (options.order) {
      options.order.forEach((prop, index) => {
        const [prop0, prop1] = prop;

        if (this.i18nModel.model[prop0]) {
          options.order[index] = [
            {
              model: this.sequelize.models[this.i18nModel.name],
              as: this.i18nModel.name,
            },
            prop0,
            prop1,
          ];
        }
      });
    }
  }
}

/**
 * @param {Object} i18nModel
 * @param {Instance} instance
 * @return {Function}
 */
function $createI18nOptions(i18nModel, instance) {
  return (acc, value) => (i18nModel.model[value]
    ? { ...acc, [value]: instance.dataValues[value] }
    : acc
  );
}

/**
 * @param {Instance} instance
 * @param {Object} options
 * @return {Promise|null}
 */
function $afterCreate(instance, options) {
  if (!this.i18nModel) return null;

  const baseOptions = this.sequelize.options.i18n || {};

  if (instance && instance.dataValues && this.i18nModel.model) {
    const i18nOptions = Object
      .keys(instance.dataValues)
      .reduce($createI18nOptions(this.i18nModel, instance), {})
    ;
    i18nOptions.language_id = options.language_id || baseOptions.defaultLanguage;
    i18nOptions.parent_id = instance.dataValues.id;

    return this.sequelize.models[this.i18nModel.name]
      .findOrCreate({
        where: {
          language_id: i18nOptions.language_id,
          parent_id: i18nOptions.parent_id,
        },
        defaults: i18nOptions,
      })
      .then(() => {
        instance.reload();
      })
      .catch((error) => {
        instance.destroy({ force: true }).then(() => {
          throw error;
        });
      })
    ;
  }

  return null;
}

/**
 * @param {Instance} instance
 * @param {Object} options
 * @return {Promise|null}
 */
function $afterUpdate(instance, options) {
  if (!this.i18nModel) return null;

  const baseOptions = this.sequelize.options.i18n || {};

  if (instance && instance.dataValues && this.i18nModel.model) {
    const i18nOptions = Object
      .keys(instance.dataValues)
      .reduce($createI18nOptions(this.i18nModel, instance), {})
    ;

    i18nOptions.language_id = options.language_id || baseOptions.defaultLanguage;
    i18nOptions.parent_id = instance.dataValues.id;

    return this.sequelize.models[this.i18nModel.name]
      .update(i18nOptions, {
        where: {
          language_id: i18nOptions.language_id,
          parent_id: i18nOptions.parent_id,
        },
      })
      .then(() => instance.reload())
    ;
  }

  return null;
}

/**
 * @param {Instance} instance
 * @return {Promise|null}
 */
function $afterDestroy(instance) {
  if (this.i18nModel === null) return null;

  return this.sequelize.models[this.i18nModel.name]
    .destroy({
      where: {
        parent_id: instance.id,
      },
    })
  ;
}

/**
 * @param {Object} newValues
 * @param {String} languageId
 * @return {Promise|null}
 */
function $addI18n(newValues, languageId) {
  const model = this.sequelize.models[this.constructor.name];
  const baseOptions = this.sequelize.options.i18n || {};

  if (!newValues || !model.i18nModel || !languageId || !baseOptions.languages.includes(languageId)) {
    return null;
  }

  const i18nOptions = {
    language_id: languageId,
    parent_id: this.id,
  };

  if (model.i18nModel.model) {
    Object.keys(newValues).forEach((prop) => {
      if (model.i18nModel.model[prop]) {
        i18nOptions[prop] = newValues[prop];
      }
    });
  }

  return this.sequelize.models[model.i18nModel.name]
    .findOrCreate({
      where: {
        language_id: languageId,
        parent_id: this.id,
      },
      defaults: i18nOptions,
    })
    .then(() => this.reload({ language_id: languageId }))
  ;
}

/**
 * @param {Object} i18nModel
 * @return {Function}
 */
function $deleteI18n(i18nModel) {
  return function deleteI18n(languageId) {
    if (!languageId) return null;

    return this.sequelize.models[i18nModel.name]
      .destroy({
        where: {
          language_id: languageId,
          parent_id: this.id,
        },
      })
    ;
  };
}

/**
 * @param {String} languageId
 * @return {String}
 */
function $getI18n(languageId) {
  const model = this.sequelize.models[this.constructor.name];

  if (!model.i18nModel) return null;

  return Object
    .values(this[model.i18nModel.name])
    .find((obj) => obj.language_id === languageId)
  ;
}

/**
 * @param {String} modelName
 * @return {Object}
 */
function $getFormattedInclude(modelName) {
  const model = this.sequelize.models[modelName];

  return {
    model,
    as: model.name,
    attributes: {
      exclude: this.excludedAttributes,
    },
  };
}

/**
 * @param {Object} defaultScope
 * @param {String} name
 */
function $setDefaultScope(defaultScope, name) {
  if (!name) return;

  defaultScope.include = [
    ...(defaultScope.include || []),
    $getFormattedInclude.call(this, name),
  ];
}

/**
 * @param {Object} scopes
 * @param {String} name
 */
function $injectI18nScope(scopes, name) {
  Object.keys(scopes).forEach((scope) => {
    scopes[scope].include = [
      ...(scopes[scope].include || []),
      $getFormattedInclude.call(this, name),
    ];
  });
}

/**
 * @param {Object} scopes
 * @param {String} name
 */
function $addI18nScope(scopes, name) {
  const include = $getFormattedInclude.call(this, name);

  scopes.i18n = (languageId) => (languageId
    ? {
      include,
      where: {
        language_id: languageId,
      },
    }
    : {
      include,
    }
  );
}

class SequelizeI18N {
  /**
   * @constructor
   * @param {Sequelize} sequelize
   * @param {Object} options
   */
  constructor(sequelize, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const { languages, defaultLanguage } = this.options;
    if (!(languages && Array.isArray(languages) && languages.length && defaultLanguage)) {
      throw new Error('Language list and default language are mandatory and can\'t be empty');
    }

    if (defaultLanguage && !languages.includes(defaultLanguage)) {
      throw new Error('Default language is invalid');
    }

    this.sequelize = sequelize;
    this.sequelize.options.i18n = this.options;
    this.i18nModels = {};
  }

  init() {
    this.sequelize.beforeDefine('beforeDefineI18n', (model, options) => {
      const i18nModelOptions = {
        indexes: [],
        paranoid: options.paranoid,
        timestamps: options.timestamps,
        underscored: options.i18n && options.i18n.underscored
          ? options.i18n.underscored
          : true,
        freezeTableName: true,
      };
      const modelPk = $getModelUniqueKey(model);
      const i18nProps = Object.entries(model).filter(([, prop]) => prop.i18n);
      if (i18nProps.length) {
        if (!modelPk) {
          throw new Error(`No primary or unique key found for ${model.modelName} model.`);
        }

        const schema = {
          language_id: {
            type: this.sequelize.Sequelize.STRING,
            unique: 'i18n_unicity_constraint',
          },
          parent_id: {
            type: modelPk.type,
            unique: 'i18n_unicity_constraint',
          },
        };
        const { deletedAt } = options;

        if (options.paranoid) {
          schema[deletedAt] = {
            type: this.sequelize.Sequelize.DATE,
            unique: 'i18n_unicity_constraint',
          };
        }

        i18nProps.forEach(([propName, prop]) => {
          if (prop.unique) {
            i18nModelOptions.indexes.push({
              unique: true,
              fields: options.paranoid
                ? ['language_id', deletedAt, propName]
                : ['language_id', propName],
            });
          }

          schema[propName] = {
            type: model[propName].type,
          };
          model[propName].type = this.sequelize.Sequelize.VIRTUAL;
        });

        if (!model.language_id || !model.language_id.type !== this.sequelize.Sequelize.VIRTUAL) {
          model.language_id = {
            type: this.sequelize.Sequelize.VIRTUAL,
          };
        }

        if (schema) {
          const i18nName = `${options.modelName}${this.options.suffix}`;
          $createI18nModel.call(this, options.modelName, schema, i18nModelOptions);

          if (this.options.i18nDefaultScope) {
            options.defaultScope = options.defaultScope || {};
            $setDefaultScope.call(this, options.defaultScope, i18nName);
          }

          if (this.options.addI18NScope) {
            options.scopes = options.scopes || {};
            $addI18nScope(options.scopes, i18nName);
          }

          if (this.options.injectI18NScope) {
            options.scopes = options.scopes || {};
            $injectI18nScope(options.scopes, i18nName);
          }
        }
      }
    });

    this.sequelize.afterDefine('afterDefineI18n', (model) => {
      if (this.i18nModels[model.name]) {
        const i18nModel = this.i18nModels[model.name];
        const i18nRealModel = this.sequelize.models[i18nModel.name];

        if (i18nModel) {
          const enhancedModel = Object.assign(model, { i18nModel, i18n: i18nRealModel });

          this.sequelize.models[model.name].hasMany(i18nRealModel, {
            as: i18nRealModel.name,
            foreignKey: 'parent_id',
            unique: 'i18n_unicity_constraint',
          });

          enhancedModel.addHook('beforeFind', 'addLanguageI18n', $addLanguage);
          enhancedModel.addHook('beforeFind', 'beforeFindI18n', $beforeFind);
          enhancedModel.addHook('afterCreate', 'afterCreateI18n', $afterCreate);
          enhancedModel.addHook('afterUpdate', 'afterUpdateI18n', $afterUpdate);
          enhancedModel.addHook('afterDestroy', 'afterDestroyI18n', $afterDestroy);

          enhancedModel.prototype.addI18n = $addI18n;
          enhancedModel.prototype.deleteI18n = $deleteI18n(i18nModel);
          enhancedModel.prototype.getI18n = $getI18n;
        }
      }
    });
  }
}

module.exports = SequelizeI18N;
