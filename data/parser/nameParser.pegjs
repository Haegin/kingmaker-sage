start = name:name specifiers:specifiers? {
  return Object.assign({
    name: name,
    needs: [],
    avoid: [],
    per: undefined,
  }, ...specifiers);
}

name = name:[A-Za-z' ]+ {
  return name.join('').trim();
}

specifiers = first:specifier rest:otherSpecifier* {
  return rest.reduce((combined, specifier) =>
    Object.assign(combined, specifier),
    first
  );
}

otherSpecifier = ' ' specifier:specifier {
  return specifier
}

specifier = '(' specifier:(per / avoid / needs)')' {
  return specifier;
}

per = 'Per ' area:[DS] {
  return { per: area === 'D' ? 'District' : 'Settlement' }
}

avoid = 'No ' need:needs {
  return { avoid: need.needs }
}

needs = first:need rest:(otherNeed)* {
  return { needs: [first, ...rest] };
}

otherNeed = needSeparator? need:need {
  return need;
}

needSeparator = ',' ' '? / ' or '

need = count:[0-9]* ' '? need:actualNeed {
  const numb = parseInt(count.join(''), 10) || 1;
  return numb > 1 ? `${numb} ${need}s` : need;
}

actualNeed = house / tenement / mansion / nobleVilla / water / land / special

house = 'H' { return 'House' }
tenement = 'T' { return 'Tenement' }
mansion = 'M' { return 'Mansion' }
nobleVilla = 'NV' { return 'Noble Villa' }
water = 'W' { return 'Water' }
land = 'L' { return 'Land' }
special = 'X' { return 'Special' }
