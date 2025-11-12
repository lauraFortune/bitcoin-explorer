
const { encodeVarInt } = require(`../utils/helper`);
const { logger } = require('../utils/logHandler');


class GetData {
  constructor({ count, inventory } = {}) {
    this.command = 'getdata';
    this.count = count; // number of inventory items
    this.inventory = inventory; // inventory items array
  }


  loadInvData(invItems) {

    let inventoryArray = [];

    invItems.forEach(item => {
      inventoryArray.push({ type: item.type, hash: item.hash });
    })

    this.count = inventoryArray.length;
    this.inventory = inventoryArray;
    
  }



  serialise() {

    const countEncoded = encodeVarInt(this.count); // Encode count as varInt

    console.log(this.inventory);
    const itemsBuffer = Buffer.concat(this.inventory.map(item => {

      const typeBuffer = Buffer.alloc(4);
      typeBuffer.writeUInt32LE(item.type, 0);
      
      const hashBuffer = Buffer.isBuffer(item.hash) ? item.hash : Buffer.from(item.hash, 'hex');
      return Buffer.concat([typeBuffer, hashBuffer]);

    }));

    const payload = Buffer.concat([ countEncoded, itemsBuffer ]); 
    return payload;
  }

}


module.exports = GetData; 



/**
Payload: (getdata) - https://learnmeabitcoin.com/technical/networking/#getdata

┌─────────────┬───────────────────┬──────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Name        │ Format            │ Size     │ Example Bytes                                                                                                │
├─────────────┼───────────────────┼──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Count       │ compact size      │ variable │ 01                                                                                                           │
│ Inventory   │ inventory vector  │ variable │ 01 00 00 00 aa 32 5e 91 22 aa 39 ca 18 c7 5a ab e2 a3 ce af 98 02 ac d1 a4 07 20 92 5b fd 77 ff f5 8e d8 21  │
└─────────────┴───────────────────┴──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */



