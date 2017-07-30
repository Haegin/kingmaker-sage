start = first:item rest:otherItem* {
  return [first].concat(rest);
} / '' {
  return [];
}

otherItem = [,;] ' ' item:item {
  return item;
}

item = count:count ' ' name:name {
  return `${count} ${name}`;
}
 
count = count:[0-9]+ {
  return parseInt(count.join(''), 10)
}

name = thing:thing otherThing:otherThing* {
  return [thing, ...otherThing].join(', ');
}

otherThing = ', ' thing:thing {
  return thing;
}

thing = desc:[A-Za-z ]+ {
  return desc.join('');
}
