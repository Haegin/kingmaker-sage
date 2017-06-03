import * as mongoose from 'mongoose'

export interface Group extends mongoose.Document {
    name: string;
    channels: string[];
}

export let GroupDatabase = mongoose.model<Group>('group', new mongoose.Schema({
    name: { type: String, index: true, required: true },
    channels: { type: [String], required: true },
}));

export interface Alias extends mongoose.Document {
    alias: string;
    real: string;
}

export let AliasDatabase = mongoose.model<Alias>('alias', new mongoose.Schema({
    alias: { type: String, index: true, required: true },
    real: { type: String, required: true },
}));

export let connect = async () => await mongoose.connect(process.env.MONGOHQ_URL);