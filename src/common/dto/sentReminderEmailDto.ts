export class SendReminderEmailDto {
  content_type: string;        
  text_content: string;        
  attachment?: string;         
  content_recipients: string[]; 
}
