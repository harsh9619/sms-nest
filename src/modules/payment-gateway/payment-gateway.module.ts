import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { School } from "../../entities/school.entity.js";
import { Fee } from "../../entities/fee.entity.js";
import { FeeReceipt } from "../../entities/fee-receipt.entity.js";
import { Student } from "../../entities/student.entity.js";
import { FeeModule } from "../fee/fee.module.js";
import { PaymentGatewayService } from "./payment-gateway.service.js";
import { PaymentGatewayController } from "./payment-gateway.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([School, Fee, FeeReceipt, Student]),
    FeeModule,
  ],
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
