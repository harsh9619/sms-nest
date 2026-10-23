import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  PaymentGatewayService,
  CreateOrderDto,
  VerifyPaymentDto,
  UpdateCredentialsDto,
} from "./payment-gateway.service.js";
import { JwtAuthGuard } from "../../common/guards/auth.guard.js";
import { toIntID } from "../../db/index.js";

@Controller("api/payment-gateway")
export class PaymentGatewayController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  /**
   * Get public Razorpay configuration for a school
   */
  @Get(":schoolId/config")
  async getPublicConfig(@Param("schoolId") schoolIdStr: string) {
    const schoolId = toIntID(schoolIdStr);
    return this.paymentGatewayService.getPublicConfig(schoolId);
  }

  /**
   * Create Razorpay order for fees
   */
  @Post(":schoolId/order")
  async createOrder(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: {
      studentId: string | number;
      feeIds: (string | number)[];
      amount?: number;
      notes?: Record<string, any>;
    }
  ) {
    const schoolId = toIntID(schoolIdStr);
    const dto: CreateOrderDto = {
      studentId: toIntID(String(body.studentId)),
      feeIds: (body.feeIds || []).map((id) => toIntID(String(id))),
      amount: body.amount ? Number(body.amount) : undefined,
      notes: body.notes,
    };
    return this.paymentGatewayService.createOrder(schoolId, dto);
  }

  /**
   * Verify Razorpay payment and complete fee payment
   */
  @Post(":schoolId/verify")
  async verifyPayment(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      studentId: string | number;
      feeIds: (string | number)[];
      remarks?: string;
    }
  ) {
    const schoolId = toIntID(schoolIdStr);
    const dto: VerifyPaymentDto = {
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      studentId: toIntID(String(body.studentId)),
      feeIds: (body.feeIds || []).map((id) => toIntID(String(id))),
      remarks: body.remarks,
    };
    return this.paymentGatewayService.verifyPayment(schoolId, dto);
  }

  /**
   * Get school's Razorpay credentials (protected)
   */
  @Get(":schoolId/credentials")
  @UseGuards(JwtAuthGuard)
  async getCredentials(@Param("schoolId") schoolIdStr: string) {
    const schoolId = toIntID(schoolIdStr);
    return this.paymentGatewayService.getCredentials(schoolId);
  }

  /**
   * Update school's Razorpay credentials (protected)
   */
  @Put(":schoolId/credentials")
  @UseGuards(JwtAuthGuard)
  async updateCredentials(
    @Param("schoolId") schoolIdStr: string,
    @Body() body: UpdateCredentialsDto
  ) {
    const schoolId = toIntID(schoolIdStr);
    return this.paymentGatewayService.updateCredentials(schoolId, body);
  }
}
