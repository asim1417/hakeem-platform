import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gate, failure, response } from "@/lib/modules/editorial/access";
import { reviewIntake } from "@/lib/modules/editorial/intake";
export const dynamic="force-dynamic";
export async function PATCH(request:NextRequest,{params}:{params:{id:string}}) {
  try {
    const {actor,sessionId}=await gate(request,true);
    const data=z.object({decision:z.enum(["approve","reject","reset"]),reason:z.string().min(1).max(2000).default("مراجعة من واجهة المبادئ القضائية")}).parse(await request.json());
    const review=await reviewIntake(actor.id,"principle",params.id,data.decision,data.reason,{},sessionId);
    const principle=await prisma.judicialPrinciple.findUnique({where:{id:params.id},select:{id:true,title:true,reviewStatus:true}});
    return response({ok:true,principle,reviewStatus:review.status,message:review.status==="published"?"سُجل قرار المراجعة":"بانتظار بقية الموافقات"});
  }catch(e){return failure(e);}
}
