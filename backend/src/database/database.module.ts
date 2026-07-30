import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import knex, { type Knex } from 'knex';
import { KNEX_CONNECTION } from './database.constants';

@Global()
@Module({
  providers: [
    {
      provide: KNEX_CONNECTION,
      useFactory: (): Knex =>
        knex({
          client: 'pg',
          connection: process.env.DATABASE_URL || 'postgres://tibo:tibo_dev_password@localhost:5434/tibo',
        }),
    },
  ],
  exports: [KNEX_CONNECTION],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(KNEX_CONNECTION) private readonly knexInstance: Knex) {}

  async onModuleDestroy() {
    await this.knexInstance.destroy();
  }
}
