import Sequelize, { DataTypes } from 'sequelize';
import fs from 'fs';

import SequelizeI18N from '../src';

const languages = {
  list: ['FR', 'EN', 'ES'],
  default: 'FR',
};

let sequelize = null;
let i18n = null;
let instance = null;
let table1 = null;
let table2 = null;

const tb1 = (sequelizeClient, DataTypes) =>
  sequelizeClient.define('table1', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    label: {
      type: DataTypes.STRING,
      i18n: true,
    },
    description: {
      type: DataTypes.STRING,
      i18n: true,
    },
    reference: {
      type: DataTypes.STRING,
    },
  }, { freezeTableName: true })
;

const tb2 = (sequelizeClient, DataTypes) =>
  sequelizeClient.define('table2', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    label: {
      type: DataTypes.STRING,
    },
    reference: {
      type: DataTypes.STRING,
    },
  }, {
    freezeTableName: true,
    i18n: {
      underscored: false,
    },
  })
;

const Models = (sequelizeClient) => {
  return {
    table1: tb1(sequelizeClient, DataTypes),
    table2: tb2(sequelizeClient, DataTypes),
  };
};

describe('SequelizeI18N', () => {
  beforeEach(async () => {
    const dbFile = `${__dirname}/test.sqlite`;

    try {
      fs.unlinkSync(dbFile);
    } catch (error) {
      console.info('Creating database file...');
    }

    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: dbFile,
      logging: false,
    });

    await sequelize.authenticate();

    i18n = new SequelizeI18N(sequelize, {
      languages: languages.list,
      defaultLanguage: languages.default,
    });

    i18n.init();

    ({ table1, table2 } = Models(sequelize));

    await sequelize.sync({ force: true });

    instance = await table1.create({
      id: 1,
      label: 'test',
      description: 'c\'est un test',
      reference: 'xxx',
    });
    await instance.addI18n({ label: 'test EN', description: 'This is a test' }, 'EN');

    await table2.create({
      id: 1,
      label: 'test2',
      description: 'test 2',
      reference: 'yyy',
    });
  });

  test('should have imported the example table1', () => {
    expect(sequelize.models).toHaveProperty('table1');
  });

  test('i18n should have the correct language list', () => {
    expect(i18n.options.languages.length).toEqual(languages.list.length);

    for (let index = 0; index < languages.list.length; index += 1) {
      expect(i18n.options.languages[index]).toEqual(languages.list[index]);
    }
  });

  test(`i18n should have \`${languages.default}\` as default language`, () => {
    expect(i18n.options.defaultLanguage).toEqual(languages.default);
  });

  test('should have created the i18n table1 table', () => {
    expect(sequelize.models).toHaveProperty('table1_i18n');
  });

  test('should have a `table1`, `table1_i18n` and `table2` tables', (done) => {
    sequelize
      .showAllSchemas()
      .then((result) => {
        expect(result).not.toBeNull();
        expect(result.length).toEqual(3);
        expect(result).toBeInstanceOf(Array);
        expect(result).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: 'table1' })])
        );
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'table1_i18n' }),
          ])
        );
        expect(result).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: 'table2' })])
        );
        done();
      })
      .catch((error) => done(error));
  });

  test('should return i18n values', (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        expect(result).toHaveProperty('table1_i18n');
        expect(result.table1_i18n.length).toEqual(2);
        expect(result.table1_i18n).toBeInstanceOf(Array);
        expect(result.table1_i18n).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: 'test',
              description: 'c\'est un test',
            }),
          ])
        );
        expect(result.table1_i18n).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: 'test EN',
              description: 'This is a test',
            }),
          ])
        );
        done();
      })
      .catch((error) => done(error));
  });

  test('should return i18n values when the filter is on the i18n field', (done) => {
    table1
      .findOne({ where: { label: 'test' } })
      .then((result) => {
        expect(result).toHaveProperty('table1_i18n');
        expect(result.table1_i18n.length).toEqual(1);
        expect(result.table1_i18n[0]).toHaveProperty('label');
        expect(result.table1_i18n[0].label).toEqual('test');
        done();
      })
      .catch((error) => done(error));
  });

  test('should return English i18n values when the filter has include', (done) => {
    table1
      .findOne({
        include: [
          {
            model: sequelize.models.table1_i18n,
            as: 'table1_i18n',
            where: { language_id: 'EN' },
          },
        ],
      })
      .then((result) => {
        expect(result).toHaveProperty('table1_i18n');
        expect(result.table1_i18n[0]).toHaveProperty('description');
        expect(result.table1_i18n[0].description).toEqual('This is a test');
        done();
      })
      .catch((error) => done(error));
  });

  test('should return English i18n values using the function', (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        const i18nResult = result.getI18n('EN');

        expect(i18nResult).toHaveProperty('description');
        expect(i18nResult.description).toEqual('This is a test');
        done();
      })
      .catch((error) => done(error));
  });

  test('should return updated English i18n values', (done) => {
    table1
      .findByPk(1)
      .then((result) =>
        result.update({ label: 'Test EN renamed' }, { language_id: 'EN' })
      )
      .then((upd) => {
        const i18nUpdate = upd.getI18n('EN');

        expect(i18nUpdate).toHaveProperty('label');
        expect(i18nUpdate).toHaveProperty('description');
        expect(i18nUpdate.description).toEqual('This is a test');
        expect(i18nUpdate.label).toEqual('Test EN renamed');
        done();
      })
      .catch((error) => done(error));
  });

  test('should return the hard-coded language ID', (done) => {
    table1
      .findByPk(1, { language_id: 'EN' })
      .then((r) => {
        expect(r).toHaveProperty('language_id');
        expect(r.language_id).toEqual('EN');
        done();
      })
      .catch((error) => done(error));
  });

  test('should delete current instance and its i18n values', () => {
    instance.destroy();
  });
});

describe('SequelizeI18N with a different suffix', () => {
  beforeEach(async () => {
    const dbFile = `${__dirname}/test2.sqlite`;

    try {
      fs.unlinkSync(dbFile);
    } catch (error) {
      console.info('Creating database file...');
    }

    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: dbFile,
      logging: false,
    });

    await sequelize.authenticate();

    i18n = new SequelizeI18N(sequelize, {
      languages: languages.list,
      defaultLanguage: languages.default,
      suffix: '-international',
    });

    i18n.init();

    const models = Models(sequelize);

    table1 = models.table1;
    table2 = models.table2;

    await sequelize.sync({ force: true });

    instance = await table1
      .create({
        id: 1,
        label: 'test',
        description: 'c\'est un test',
        reference: 'xxx',
      })
      .then((inst) =>
        inst.addI18n({ label: 'test EN', description: 'This is a test' }, 'EN')
      );
  });

  test('should have created the international table1 table', () => {
    expect(sequelize.models).toHaveProperty('table1-international');
  });

  test('should have a `table1` and `table1-international` tables', (done) => {
    sequelize
      .showAllSchemas()
      .then((result) => {
        expect(result).not.toBeNull();
        expect(result.length).toEqual(3);
        expect(result).toBeInstanceOf(Array);
        expect(result).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: 'table1' })])
        );
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'table1-international' }),
          ])
        );
        done();
      })
      .catch((error) => done(error));
  });

  test('should return i18n values', (done) => {
    table1
      .findByPk(1)
      .then((result) => {
        expect(result).toHaveProperty('table1-international');
        expect(result['table1-international'].length).toEqual(2);
        expect(result['table1-international']).toBeInstanceOf(Array);
        expect(result['table1-international']).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: 'test',
              description: 'c\'est un test',
            }),
          ])
        );
        expect(result['table1-international']).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: 'test EN',
              description: 'This is a test',
            }),
          ])
        );
        done();
      })
      .catch((error) => done(error));
  });

  test('should return i18n values when the filter is on the i18n field', (done) => {
    table1
      .findOne({ where: { label: 'test' } })
      .then((result) => {
        expect(result).toHaveProperty('table1-international');
        expect(result['table1-international'].length).toEqual(1);
        expect(result['table1-international'][0]).toHaveProperty('label');
        expect(result['table1-international'][0].label).toEqual('test');
        done();
      })
      .catch((error) => done(error));
  });

  // TODO: add tests to check if model update works.

  test('should delete current instance and its i18n values', () => {
    instance.destroy();
  });
});
