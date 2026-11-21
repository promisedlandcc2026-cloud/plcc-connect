import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import {pastoralService,pastoralMessage} from '../lib/pastoralService.js';
describe('website pastoral request prefill',()=>{
  it('maps only known services to the existing categories',()=>{
    assert.deepEqual(pastoralService('baptism'),{category:'baptism',label:null});
    assert.deepEqual(pastoralService('counseling'),{category:'counseling',label:null});
    assert.deepEqual(pastoralService('wedding'),{category:'appointment',label:'Wedding'});
    assert.deepEqual(pastoralService('dedication'),{category:'appointment',label:'Child dedication'});
    assert.deepEqual(pastoralService('unknown'),{category:'appointment',label:null});
  });
  it('preserves the selected service without applying it to other categories',()=>{
    assert.equal(pastoralMessage('Wedding','appointment','hello'),'[Service: Wedding]\nhello');
    assert.equal(pastoralMessage('Wedding','counseling','hello'),'hello');
  });
});
