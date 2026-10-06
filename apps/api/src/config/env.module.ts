import { Global, Module } from '@nestjs/common';
import { type ApiEnv, loadApiEnv } from '@dating/config';

export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): ApiEnv => loadApiEnv() }],
  exports: [ENV],
})
export class EnvModule {}
