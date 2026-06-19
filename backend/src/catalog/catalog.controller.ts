import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../common/decorators';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('pieces')
  findAll() {
    return this.catalogService.findAll();
  }
}
