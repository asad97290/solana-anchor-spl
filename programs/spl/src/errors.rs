

use anchor_lang::prelude::*;


#[error_code]
pub enum CustomError {
    #[msg("Can not mint more tokens")]
    CapExceed,
}
