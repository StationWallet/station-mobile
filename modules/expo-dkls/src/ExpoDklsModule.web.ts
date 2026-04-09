import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoDkls.types';

type ExpoDklsModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoDklsModule extends NativeModule<ExpoDklsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoDklsModule, 'ExpoDklsModule');
