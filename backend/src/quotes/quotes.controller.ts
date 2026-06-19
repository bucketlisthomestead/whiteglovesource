import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from '../common/dto';
import {
  CompleteQuoteDto,
  CreateQuoteLeadDto,
  QuoteEstimateDto,
} from '../common/quote.dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Public()
  @Post('estimate')
  estimate(@Body() dto: QuoteEstimateDto) {
    return this.quotesService.estimate(dto);
  }

  @Public()
  @Post('lead')
  createLead(@Body() dto: CreateQuoteLeadDto) {
    return this.quotesService.createLead(dto);
  }

  @Public()
  @Patch(':id')
  completeLead(@Param('id') id: string, @Body() dto: CompleteQuoteDto) {
    return this.quotesService.completeLead(id, dto);
  }

  @Public()
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quotesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.quotesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }
}
