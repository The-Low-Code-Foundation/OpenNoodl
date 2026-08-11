'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Device Orientation node. */
interface GyroscopeNodeInstance extends NodeInstance {
  _internal: {
    alpha: number;
    beta: number;
    gamma: number;
  };
}

const GyroscopeNode: NodeDefinitionOptions = {
  name: 'Gyroscope',
  docs: 'https://docs.noodl.net/nodes/sensors/device-orientation',
  displayNodeName: 'Device Orientation',
  category: 'Sensors',
  deprecated: true,
  // initialize registers a window listener unconditionally.
  ssr: { compat: 'client-only', note: 'Device sensors only exist in the browser.' },
  initialize: function (this: GyroscopeNodeInstance) {
    this._internal.alpha = 0;
    this._internal.beta = 0;
    this._internal.gamma = 0;

    const onEvent = onDeviceOrientation.bind(this);
    window.addEventListener('deviceorientation', onEvent);
    this.context.eventEmitter.once('applicationDataReloaded', function () {
      window.removeEventListener('deviceorientation', onEvent);
    });
  },
  outputs: {
    rotationX: {
      group: 'Values',
      type: 'number',
      displayName: 'Rotation X',
      description: 'Front-to-back tilt in degrees; it never updates on iOS, which requires a permission this node does not request',
      getter: function (this: GyroscopeNodeInstance) {
        return -this._internal.beta;
      }
    },
    rotationY: {
      group: 'Values',
      type: 'number',
      displayName: 'Rotation Y',
      description: 'Left-to-right tilt in degrees; it never updates on iOS, which requires a permission this node does not request',
      getter: function (this: GyroscopeNodeInstance) {
        return this._internal.gamma;
      }
    },
    rotationZ: {
      group: 'Values',
      type: 'number',
      displayName: 'Rotation Z',
      description: 'Compass heading in degrees; it never updates on iOS, which requires a permission this node does not request',
      getter: function (this: GyroscopeNodeInstance) {
        return -this._internal.alpha;
      }
    }
  }
};

function onDeviceOrientation(this: GyroscopeNodeInstance, event: DeviceOrientationEvent) {
  /* jshint validthis:true */
  if (event.alpha !== this._internal.alpha) {
    this._internal.alpha = event.alpha;
    this.flagOutputDirty('rotationZ');
  }
  if (event.beta !== this._internal.beta) {
    this._internal.beta = event.beta;
    this.flagOutputDirty('rotationX');
  }
  if (event.gamma !== this._internal.gamma) {
    this._internal.gamma = event.gamma;
    this.flagOutputDirty('rotationY');
  }
}

const GyroscopeNodeModule: NodeModule = {
  node: GyroscopeNode
};

export default GyroscopeNodeModule;
