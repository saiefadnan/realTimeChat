import { Encoder as DefaultEncoder, Decoder as DefaultDecoder } from 'socket.io-parser';
import Emitter from 'component-emitter';

class CustomEncoder extends DefaultEncoder {
  encode(packet, callback) {
    // Custom encode logic
    console.log('Encoding packet:', packet);
    super.encode(packet, callback); // Use the default encoding
  }
}

class CustomDecoder extends Emitter {
  constructor() {
    super();
    this.reconstructor = null;
  }

  add(data) {
    // Custom decode logic
    console.log('Decoding data:', data);
    const decoded = DefaultDecoder.prototype.add.call(this, data); // Use the default decoding
    if (decoded) {
      this.emit('decoded', decoded);
    }
  }

  destroy() {
    console.log('Destroying decoder');
    DefaultDecoder.prototype.destroy.call(this);
  }
}

const CustomParser = {
  Encoder: CustomEncoder,
  Decoder: CustomDecoder
};

export default CustomParser;
