import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from '../entities/contact-message.entity';
import { CreateContactDto } from '../common/dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateContactDto) {
    const message = this.contactRepo.create(dto);
    const saved = await this.contactRepo.save(message);
    await this.emailService.notifyOwnerContact(dto).catch(() => {});
    return saved;
  }

  findAll() {
    return this.contactRepo.find({ order: { createdAt: 'DESC' } });
  }
}
