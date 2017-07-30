require('dotenv').config();
const fs = require('fs');
const parse = require('csv-parse');

import { MongoClient, Db, Collection } from 'mongodb';
import { camelCase } from 'lodash';
import { parse as parseName } from './data/parser/nameParser';
import { parse as parseMagicItems } from './data/parser/magicItemParser';

import Building from './data/building';

const insertBuildings = (buildings: Building[]) => {
  MongoClient.connect(process.env.MONGOHQ_URL).
    then(db => {
      db.collection('buildings').insertMany(buildings);
      db.close();
    }).catch(console.log);
};

console.log('Clearing existing building data');
MongoClient.connect(process.env.MONGOHQ_URL).
  then(db => {
    db.collection('buildings').deleteMany({});
    db.close();
  }).catch(console.log);

console.log(`Loading KingMaker Data from ${process.argv[2]}`);
fs.readFile(process.argv[2], 'utf-8', (err, data) => {
  if (err) throw err;
  const parseOpts = {
    columns: headers => headers.map(h => camelCase(h)),
  };
  parse(data, parseOpts, (err, csv) => {
    if (err) throw err;
    const buildings = csv.map(buildingData => {
      console.log(`Loading ${buildingData.improvements}`)
      const nameInfo = parseName(buildingData.improvements.trim())
      return {
        ...nameInfo,
        cost: parseInt(buildingData.cost),
        lots: parseInt(buildingData.lots),
        economy: parseInt(buildingData.economy) || 0,
        loyalty: parseInt(buildingData.loyalty) || 0,
        stability: parseInt(buildingData.stability) || 0,
        defense: parseInt(buildingData.defense) || 0,
        unrest: parseInt(buildingData.unrest) || 0,
        baseValue: parseInt(buildingData.baseValue) || 0,
        discounts: buildingData.discount ? buildingData.discount.split(', ') : [],
        magicItems: parseMagicItems(buildingData.magicItem.trim()),
      }
    });
    insertBuildings(buildings);
  });
});
