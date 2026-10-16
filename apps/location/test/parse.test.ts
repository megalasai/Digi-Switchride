import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAdmin1Line, parseAdmin2Line, parsePlaceLine, parsePostalLine } from '../src/parse.ts';

test('parses a GeoNames populated place and skips abandoned places', () => {
  const line = [
    '1277333',
    'Bengaluru',
    'Bengaluru',
    'Bangalore',
    '12.97194',
    '77.59369',
    'P',
    'PPLA',
    'IN',
    '',
    '19',
    '583',
    '',
    '',
    '8443675',
    '920',
    '920',
    'Asia/Kolkata',
    '2024-01-01',
  ].join('\t');
  const place = parsePlaceLine(line);
  assert.equal(place?.name, 'Bengaluru');
  assert.equal(place?.admin1Code, '19');
  assert.equal(place?.admin2Code, '583');
  assert.equal(place?.population, 8443675);
  assert.equal(place?.elevation, 920);

  const abandoned = line.replace('\tPPLA\t', '\tPPLQ\t');
  assert.equal(parsePlaceLine(abandoned), null);
  assert.equal(parsePlaceLine('not-a-place'), null);

  const road = line.replace('Bengaluru', 'Kasturba Road').replace('\t8443675\t', '\t0\t');
  assert.equal(parsePlaceLine(road), null);
});

test('parses India admin divisions and PIN codes', () => {
  assert.deepEqual(parseAdmin1Line('IN.19\tKarnataka\tKarnataka\t1267701'), {
    code: '19',
    admin1Code: null,
    name: 'Karnataka',
    asciiName: 'Karnataka',
  });
  assert.equal(parseAdmin1Line('US.CA\tCalifornia\tCalifornia\t1'), null);
  assert.deepEqual(parseAdmin2Line('IN.19.583\tBengaluru Urban\tBengaluru Urban\t1277333'), {
    code: '19.583',
    admin1Code: '19',
    name: 'Bengaluru Urban',
    asciiName: 'Bengaluru Urban',
  });

  const postal = parsePostalLine(
    'IN\t560001\tBengaluru GPO\tKarnataka\t19\tBengaluru Urban\t583\t\t\t12.9766\t77.5993\t4',
  );
  assert.equal(postal?.postalCode, '560001');
  assert.equal(postal?.admin2Name, 'Bengaluru Urban');
  assert.equal(parsePostalLine('IN\t000000\tNowhere\tKarnataka\t19\t\t\t\t\t0\t0\t1'), null);
});
