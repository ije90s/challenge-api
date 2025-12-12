import { CreateDateColumn, UpdateDateColumn } from "typeorm";

export abstract class CommonEntity {
    
    @CreateDateColumn({type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({type: 'timestamp' })
    updated_at: Date;
}