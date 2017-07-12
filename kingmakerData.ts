import { MongoClient, Db, Collection } from 'mongodb';

export class KingmakerData {
  conn(): Promise<Db> {
    return MongoClient.connect(process.env.MONGOHQ_URL)
  }

  findBuildings(query: string) {
    return this.buildings().
      then(collection => collection.find({$text: {$search: query, }})).
      then(buildings => buildings.toArray())
  }

  buildingInfo(name: string) {
    return this.buildings().
      then(collection => collection.findOne({name: name}))
  }

  private buildings(): Promise<Collection> {
    return this.conn().
      then(db => db.collection('buildings'));
  }
}
